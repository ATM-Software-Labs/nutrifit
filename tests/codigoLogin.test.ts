/** Código de 6 cifras: generación, hash, intentos, un solo uso y endpoint. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cerrarSolicitudesLogin, crearCodigoLogin, generarCodigo, MAX_INTENTOS_CODIGO, verificarCodigoLogin } from '../functions/utils/codigoLogin.ts'
import { DURACION_MAGIC } from '../functions/utils/magicLink.ts'
import { onRequestPost as postCodigo } from '../functions/api/auth/codigo.ts'
import { capturar, ctx, entornoTest, postJson } from './d1Sqlite.ts'

const otro = (c: string) => String((Number(c) + 1) % 1_000_000).padStart(6, '0')

test('generarCodigo: siempre 6 cifras', () => {
  for (let i = 0; i < 2000; i++) assert.match(generarCodigo(), /^\d{6}$/)
})

test('en D1 solo se guarda el HMAC, nunca el código', async () => {
  const env = entornoTest()
  const c = await crearCodigoLogin(env, 'ana@ejemplo.es')
  const fila = env.DB.sqlite.prepare('SELECT * FROM codigos_login').get()
  assert.equal(fila.codigo_hash.length, 64)
  assert.ok(!JSON.stringify(fila).includes(c))
})

test('código correcto → ok una sola vez', async () => {
  const env = entornoTest()
  const c = await crearCodigoLogin(env, 'ana@ejemplo.es')
  assert.deepEqual(await verificarCodigoLogin(env, 'ANA@ejemplo.es', c), { ok: true, email: 'ana@ejemplo.es' })
  assert.equal((await verificarCodigoLogin(env, 'ana@ejemplo.es', c)).ok, false)
})

test(`${MAX_INTENTOS_CODIGO} fallos invalidan el código (aunque luego sea el correcto)`, async () => {
  const env = entornoTest()
  const c = await crearCodigoLogin(env, 'ana@ejemplo.es')
  for (let i = 1; i < MAX_INTENTOS_CODIGO; i++) assert.deepEqual(await verificarCodigoLogin(env, 'ana@ejemplo.es', otro(c)), { ok: false, motivo: 'invalido' })
  assert.deepEqual(await verificarCodigoLogin(env, 'ana@ejemplo.es', otro(c)), { ok: false, motivo: 'agotado' })
  assert.equal((await verificarCodigoLogin(env, 'ana@ejemplo.es', c)).ok, false)
})

test('caducado (plazo del código) y código de otro email no valen', async () => {
  const env = entornoTest()
  const t0 = 1_800_000_000
  const c = await crearCodigoLogin(env, 'ana@ejemplo.es', t0)
  assert.equal((await verificarCodigoLogin(env, 'luis@ejemplo.es', c, t0 + 10)).ok, false)
  assert.equal((await verificarCodigoLogin(env, 'ana@ejemplo.es', c, t0 + DURACION_MAGIC + 1)).ok, false)
})

test('pedir un código nuevo invalida el anterior; entrar por enlace invalida el código', async () => {
  const env = entornoTest()
  const viejo = await crearCodigoLogin(env, 'ana@ejemplo.es')
  const nuevo = await crearCodigoLogin(env, 'ana@ejemplo.es')
  if (viejo !== nuevo) assert.equal((await verificarCodigoLogin(env, 'ana@ejemplo.es', viejo)).ok, false)
  await cerrarSolicitudesLogin(env, 'ana@ejemplo.es')
  assert.equal((await verificarCodigoLogin(env, 'ana@ejemplo.es', nuevo)).ok, false)
})

test('POST /api/auth/codigo: web → cookie nf_session; app → Bearer; incorrecto → 400', async () => {
  const env = entornoTest()
  const c = await crearCodigoLogin(env, 'ana@ejemplo.es')
  const mal = await capturar(postCodigo(ctx(env, postJson('/api/auth/codigo', { email: 'ana@ejemplo.es', codigo: otro(c) }))))
  assert.equal(mal.status, 400)
  const res = await postCodigo(ctx(env, postJson('/api/auth/codigo', { email: 'ana@ejemplo.es', codigo: `${c.slice(0, 3)} ${c.slice(3)}` })))
  assert.equal(res.status, 200)
  assert.match(res.headers.get('Set-Cookie') ?? '', /^__Host-nf_session=.+HttpOnly; Secure; SameSite=Strict; Path=\//)
  assert.doesNotMatch(res.headers.get('Set-Cookie') ?? '', /Domain=/)
  const body = (await res.json()) as any
  assert.equal(body.usuario.email, 'ana@ejemplo.es')
  assert.equal(body.perfilCompleto, false)

  const c2 = await crearCodigoLogin(env, 'ana@ejemplo.es')
  const app = await postCodigo(ctx(env, postJson('/api/auth/codigo', { email: 'ana@ejemplo.es', codigo: c2, cliente: 'app' })))
  const b2 = (await app.json()) as any
  assert.ok(typeof b2.token === 'string' && b2.token.includes('.'))
  assert.equal(app.headers.get('Set-Cookie'), null)
})
