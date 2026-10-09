import { test } from 'node:test'
import assert from 'node:assert/strict'
import { firmar, timingSafeEqual, verificarFirma, base64urlEncode, base64urlDecodeText } from '../functions/utils/crypto.ts'
import { comidaGuardarSchema, calcularSchema, solicitarSchema } from '../functions/utils/schemas.ts'
import { contieneScriptPoliglota, detectarMime } from '../functions/utils/ia.ts'
import { crearCookieSesion, leerSesion, resolverSesion, ROTACION_SESION } from '../functions/utils/session.ts'
import { exigirLimite } from '../functions/utils/rateLimit.ts'
import { capturar, entornoTest, SECRETO_TEST } from './d1Sqlite.ts'

const S = 'x'.repeat(40)

test('firma HMAC válida, manipulada y con otro propósito', async () => {
  const t = await firmar(S, 'sesion', { sub: 'u1', exp: 9999999999 })
  assert.deepEqual(await verificarFirma(S, 'sesion', t), { sub: 'u1', exp: 9999999999 })
  // payload alterado
  const [, firma] = t.split('.')
  const falso = base64urlEncode(JSON.stringify({ sub: 'admin', exp: 9999999999 })) + '.' + firma
  assert.equal(await verificarFirma(S, 'sesion', falso), null)
  // un token de sesión no vale como magic link
  assert.equal(await verificarFirma(S, 'magic', t), null)
  // otro secreto
  assert.equal(await verificarFirma('y'.repeat(40), 'sesion', t), null)
  assert.equal(await verificarFirma(S, 'sesion', 'basura'), null)
})

test('timingSafeEqual y base64url', () => {
  assert.ok(timingSafeEqual('abc', 'abc'))
  assert.ok(!timingSafeEqual('abc', 'abd'))
  assert.ok(!timingSafeEqual('abc', 'abcd'))
  assert.equal(base64urlDecodeText(base64urlEncode('ñandú ✓')), 'ñandú ✓')
})

const comida = { tipo_comida: 'cena', descripcion: 'Tortilla', calorias: 300, proteinas: 20, carbohidratos: 10, grasas: 20, fecha: '2026-10-06' }

test('comida válida; texto tipo SQLi se acepta como dato (se guarda con bind)', () => {
  assert.ok(comidaGuardarSchema.safeParse(comida).success)
  assert.ok(comidaGuardarSchema.safeParse({ ...comida, descripcion: "x'); DROP TABLE usuarios;--" }).success)
})

test('comida inválida: HTML, negativos, fecha imposible, macros incoherentes', () => {
  assert.ok(!comidaGuardarSchema.safeParse({ ...comida, descripcion: '<img src=x onerror=alert(1)>' }).success)
  assert.ok(!comidaGuardarSchema.safeParse({ ...comida, calorias: -1 }).success)
  assert.ok(!comidaGuardarSchema.safeParse({ ...comida, fecha: '2026-02-30' }).success)
  assert.ok(!comidaGuardarSchema.safeParse({ ...comida, calorias: 10, proteinas: 200 }).success)
  assert.ok(!comidaGuardarSchema.safeParse({ ...comida, tipo_comida: 'merienda' }).success)
})

test('rangos fisiológicos del cálculo', () => {
  const ok = { edad: 30, sexo: 'hombre', peso: 80, altura: 180, actividad: 'ligero', objetivo: 'mantenimiento' }
  assert.ok(calcularSchema.safeParse(ok).success)
  assert.ok(!calcularSchema.safeParse({ ...ok, edad: 9 }).success)
  assert.ok(!calcularSchema.safeParse({ ...ok, peso: 500 }).success)
  assert.ok(!calcularSchema.safeParse({ ...ok, altura: 90 }).success)
})

test('email normalizado', () => {
  const r = solicitarSchema.parse({ email: '  Alberto@Example.COM ' })
  assert.equal(r.email, 'alberto@example.com')
  assert.ok(!solicitarSchema.safeParse({ email: 'no-es-email' }).success)
})

test('texto con controles se aplana; HTML sigue rechazado', () => {
  const r = comidaGuardarSchema.parse({ ...comida, descripcion: 'Tortilla\r\ncon\tpimiento' })
  assert.equal(r.descripcion, 'Tortilla con pimiento')
})

test('cookie __Host- con rotación, gracia y revocación si se reutiliza', async () => {
  const env = entornoTest()
  env.DB.sqlite.prepare("INSERT INTO usuarios (id, email) VALUES ('u1', 'a@b.es')").run()
  const ahora = Math.floor(Date.now() / 1000)
  const emitida = await crearCookieSesion(env, 'u1', 'a@b.es', ahora - ROTACION_SESION - 10)
  assert.match(emitida, /^__Host-nf_session=[^;]+; HttpOnly; Secure; SameSite=Strict; Path=\/; Max-Age=\d+$/)
  assert.doesNotMatch(emitida, /Domain=/)
  const req = (setCookie: string) => new Request('https://n/api/auth/yo', { headers: { Cookie: setCookie.split(';')[0]! } })

  const rotada = await resolverSesion(env, req(emitida))
  assert.equal(rotada.sesion?.usuarioId, 'u1')
  assert.equal(rotada.cookies.length, 1)
  const enGracia = await resolverSesion(env, req(emitida))
  assert.equal(enGracia.sesion?.usuarioId, 'u1')
  assert.equal(enGracia.cookies.length, 0)

  const nueva = await resolverSesion(env, req(rotada.cookies[0]!))
  assert.equal(nueva.sesion?.usuarioId, 'u1')
  env.DB.sqlite.prepare('UPDATE sesiones_web SET gracia_hasta = ? WHERE reemplazado_por IS NOT NULL').run(ahora - 1)
  assert.equal((await resolverSesion(env, req(emitida))).sesion, null, 'reusar el sid viejo revoca la familia')
  assert.equal(await leerSesion(env, req(rotada.cookies[0]!)), null)

  const suelto = await firmar(SECRETO_TEST, 'sesion', { sub: 'u1', em: 'a@b.es', iat: ahora, exp: ahora + 100, v: 2, sid: 'no-esta', fam: 'tampoco' })
  assert.equal(await leerSesion(env, req(`__Host-nf_session=${suelto}`)), null, 'un sid firmado que no está en D1 no fija sesión')
})

test('pico anómalo bloquea la clave aunque la ventana siga', async () => {
  const env = entornoTest()
  let ultimo: { status?: number; extra?: { codigo?: string } } | undefined
  for (let i = 0; i < 16; i++) {
    ultimo = await capturar(exigirLimite(env, 'login:test', 5, 900, 'limite', { factorPico: 3, bloqueoSeg: 3600, mensajeBloqueo: 'bloqueado' }))
  }
  assert.equal(ultimo?.status, 429)
  assert.equal(ultimo?.extra?.codigo, 'bloqueado')
})

test('detección de imagen por bytes mágicos', () => {
  assert.equal(detectarMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg')
  assert.equal(detectarMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'image/png')
  assert.equal(detectarMime(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ')), 'image/webp')
  assert.equal(detectarMime(new TextEncoder().encode('<svg onload=alert(1)>')), null)
  assert.equal(contieneScriptPoliglota(new TextEncoder().encode('<script>alert(1)</script>')), true)
  assert.equal(contieneScriptPoliglota(new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0x11])), false)
})
