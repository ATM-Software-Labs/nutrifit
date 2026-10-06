import { test } from 'node:test'
import assert from 'node:assert/strict'
import { firmar, timingSafeEqual, verificarFirma, base64urlEncode, base64urlDecodeText } from '../functions/utils/crypto.ts'
import { comidaGuardarSchema, calcularSchema, solicitarSchema } from '../functions/utils/schemas.ts'
import { detectarMime } from '../functions/utils/ia.ts'

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

test('detección de imagen por bytes mágicos', () => {
  assert.equal(detectarMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg')
  assert.equal(detectarMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'image/png')
  assert.equal(detectarMime(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ')), 'image/webp')
  assert.equal(detectarMime(new TextEncoder().encode('<svg onload=alert(1)>')), null)
})
