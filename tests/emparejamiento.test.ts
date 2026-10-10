/** Login por QR: secreto del PC, aprobación desde el móvil, un solo uso y caducidad. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { base64urlEncode, bytesAleatorios, sha256Hex } from '../functions/utils/crypto.ts'
import {
  crearEmparejamiento,
  decidirEmparejamiento,
  describirDispositivo,
  describirUbicacion,
  DURACION_QR,
  estadoEmparejamiento,
  infoEmparejamiento,
} from '../functions/utils/emparejamiento.ts'
import { onRequestPost as crear } from '../functions/api/auth/qr/crear.ts'
import { onRequestPost as estado } from '../functions/api/auth/qr/estado.ts'
import { onRequestGet as info } from '../functions/api/auth/qr/info.ts'
import { onRequestPost as decidir } from '../functions/api/auth/qr/decidir.ts'
import { leerSesion } from '../functions/utils/session.ts'
import { capturar, ctx, entornoTest, postJson } from './d1Sqlite.ts'

const USUARIO = { usuarioId: 'u-1', email: 'ana@ejemplo.es' }
async function conUsuario() {
  const env = entornoTest()
  env.DB.sqlite.prepare("INSERT INTO usuarios (id, email) VALUES ('u-1', 'ana@ejemplo.es')").run()
  return env
}
const nuevoSecreto = () => base64urlEncode(bytesAleatorios(32))

test('describirDispositivo / describirUbicacion', () => {
  assert.equal(describirDispositivo('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36'), 'Chrome · Windows')
  assert.equal(describirDispositivo('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'), 'Safari · macOS')
  assert.equal(describirDispositivo('Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0'), 'Firefox · Linux')
  assert.equal(describirUbicacion({ city: 'Madrid', country: 'ES' }), 'Madrid, ES')
  assert.equal(describirUbicacion({ city: '<script>', country: 'xx' }), 'script')
  assert.equal(describirUbicacion(undefined), null)
})

test('flujo completo: pendiente → aprobado (una vez) → ya no vale', async () => {
  const env = await conUsuario()
  const secreto = nuevoSecreto()
  const e = await crearEmparejamiento(env, await sha256Hex(secreto), 'Chrome · Windows', 'Madrid, ES')
  assert.match(e.codigo, /^[A-HJ-NP-Z2-9]{4}$/)
  // En D1 no está el id en claro
  assert.ok(!JSON.stringify(env.DB.sqlite.prepare('SELECT * FROM emparejamientos_qr').all()).includes(e.id))

  assert.equal((await estadoEmparejamiento(env, e.id, secreto)).estado, 'pendiente')
  assert.equal((await estadoEmparejamiento(env, e.id, nuevoSecreto())).estado, 'invalido', 'sin el secreto del PC no hay nada')
  assert.equal((await infoEmparejamiento(env, e.id))?.dispositivo, 'Chrome · Windows')

  assert.equal(await decidirEmparejamiento(env, e.id, 'u-1', true), true)
  assert.equal(await decidirEmparejamiento(env, e.id, 'u-1', true), false, 'no se decide dos veces')
  assert.equal((await estadoEmparejamiento(env, e.id, nuevoSecreto())).estado, 'invalido', 'aprobado pero sin secreto: nada')
  assert.deepEqual(await estadoEmparejamiento(env, e.id, secreto), { estado: 'aprobado', usuarioId: 'u-1' })
  assert.equal((await estadoEmparejamiento(env, e.id, secreto)).estado, 'invalido', 'la sesión se entrega una sola vez')
})

test('rechazado y caducado', async () => {
  const env = await conUsuario()
  const t0 = 1_800_000_000
  const s1 = nuevoSecreto()
  const a = await crearEmparejamiento(env, await sha256Hex(s1), 'x', null, t0)
  assert.equal(await decidirEmparejamiento(env, a.id, 'u-1', false, t0 + 5), true)
  assert.equal((await estadoEmparejamiento(env, a.id, s1, t0 + 6)).estado, 'rechazado')

  const s2 = nuevoSecreto()
  const b = await crearEmparejamiento(env, await sha256Hex(s2), 'x', null, t0)
  assert.equal(await infoEmparejamiento(env, b.id, t0 + DURACION_QR + 1), null)
  assert.equal(await decidirEmparejamiento(env, b.id, 'u-1', true, t0 + DURACION_QR + 1), false, 'no se aprueba tras 2 min')
  assert.equal((await estadoEmparejamiento(env, b.id, s2, t0 + DURACION_QR + 1)).estado, 'caducado')

  const s3 = nuevoSecreto()
  const c = await crearEmparejamiento(env, await sha256Hex(s3), 'x', null, t0)
  await decidirEmparejamiento(env, c.id, 'u-1', true, t0 + 100)
  assert.equal((await estadoEmparejamiento(env, c.id, s3, t0 + 100 + 61)).estado, 'caducado', 'aprobado pero no recogido a tiempo')
})

test('endpoints: crear → info/decidir (móvil con sesión) → estado (PC) recibe su propia cookie', async () => {
  const env = await conUsuario()
  const secreto = nuevoSecreto()
  const rc = await crear(ctx(env, postJson('/api/auth/qr/crear', { secretoHash: await sha256Hex(secreto) })))
  const { id, codigo, url } = (await rc.json()) as any
  assert.equal(url, `https://nutri.trujillomingorance.com/vincular#${id}`)

  const sinSesion = await capturar(info(ctx(env, new Request(`https://n/api/auth/qr/info?id=${id}`))))
  assert.equal(sinSesion.status, 401)
  const ri = await info(ctx(env, new Request(`https://n/api/auth/qr/info?id=${id}`), USUARIO))
  assert.equal(((await ri.json()) as any).codigo, codigo)

  const p1 = await estado(ctx(env, postJson('/api/auth/qr/estado', { id, secreto })))
  assert.equal(((await p1.json()) as any).estado, 'pendiente')
  assert.equal(p1.headers.get('Set-Cookie'), null)

  await decidir(ctx(env, postJson('/api/auth/qr/decidir', { id, aprobar: true }), USUARIO))
  const p2 = await estado(ctx(env, postJson('/api/auth/qr/estado', { id, secreto })))
  const cookie = p2.headers.get('Set-Cookie') ?? ''
  assert.match(cookie, /^__Host-nf_session=.+HttpOnly; Secure; SameSite=Lax; Path=\//)
  assert.doesNotMatch(cookie, /Domain=/)
  const s = await leerSesion(env, new Request('https://n/', { headers: { Cookie: cookie.split(';')[0]! } }))
  assert.equal(s?.usuarioId, 'u-1')

  const otraVez = await capturar(decidir(ctx(env, postJson('/api/auth/qr/decidir', { id, aprobar: true }), USUARIO)))
  assert.equal(otraVez.status, 410)
})
