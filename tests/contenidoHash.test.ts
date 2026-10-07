import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hashContenido, hashEnviado } from '../functions/utils/contenidoHash.ts'
import { onRequestPost as postAgua } from '../functions/api/agua.ts'
import { onRequestPost as postPeso } from '../functions/api/peso.ts'
import { ctx, entornoTest } from './d1Sqlite.ts'

test('el hash ignora el orden de las claves y no depende de campos ausentes', async () => {
  const a = await hashContenido({ fecha: '2026-10-06', ml: 500 })
  const b = await hashContenido({ ml: 500, fecha: '2026-10-06' })
  const c = await hashContenido({ fecha: '2026-10-06', ml: 750 })
  assert.equal(a, b)
  assert.equal(a.length, 64)
  assert.notEqual(a, c)
})

test('If-None-Match e If-Match aceptan el hex con o sin comillas', () => {
  const hash = 'a'.repeat(64)
  assert.equal(hashEnviado(new Request('https://x', { headers: { 'If-None-Match': `"${hash}"` } })), hash)
  assert.equal(hashEnviado(new Request('https://x', { headers: { 'If-Match': `W/"${hash}"` } })), hash)
  assert.equal(hashEnviado(new Request('https://x')), null)
})

test('repetir el agua con el mismo hash no reescribe la fila', async () => {
  const env = entornoTest()
  env.DB.sqlite.prepare("INSERT INTO usuarios (id, email) VALUES ('u1', 'a@b.es')").run()
  const sesion = { usuarioId: 'u1', email: 'a@b.es' }
  const body = { fecha: '2026-10-06', ml: 500, modo: 'fijar' }
  const hash = await hashContenido({ fecha: '2026-10-06', ml: 500 })
  const alta = await postAgua(ctx(env, new Request('https://nutri.trujillomingorance.com/api/agua', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Sync-Prioridad': 'alta' },
    body: JSON.stringify(body),
  }), sesion))
  assert.equal(alta.status, 200)
  env.DB.sqlite.prepare("UPDATE registro_agua SET actualizado_en = '2000-01-01T00:00:00'").run()

  const igual = await postAgua(ctx(env, new Request('https://nutri.trujillomingorance.com/api/agua', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'If-None-Match': `"${hash}"`, 'X-Sync-Prioridad': 'alta' },
    body: JSON.stringify(body),
  }), sesion))
  assert.equal(igual.status, 304)
  assert.equal(igual.headers.get('etag'), `"${hash}"`)
  const fila = env.DB.sqlite.prepare('SELECT ml, actualizado_en FROM registro_agua').get() as { ml: number; actualizado_en: string }
  assert.equal(fila.ml, 500)
  assert.equal(fila.actualizado_en, '2000-01-01T00:00:00')
})

test('repetir el peso con If-Match no reescribe historico ni perfil', async () => {
  const env = entornoTest()
  env.DB.sqlite.prepare("INSERT INTO usuarios (id, email, peso_kg, actualizado_en) VALUES ('u1', 'a@b.es', 70, '2000-01-01')").run()
  const sesion = { usuarioId: 'u1', email: 'a@b.es' }
  const body = { peso: 70, fecha: '2026-10-06' }
  const hash = await hashContenido({ fecha: '2026-10-06', peso: 70 })
  const alta = await postPeso(ctx(env, new Request('https://nutri.trujillomingorance.com/api/peso', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Sync-Prioridad': 'alta' },
    body: JSON.stringify(body),
  }), sesion))
  assert.equal(alta.status, 201)
  env.DB.sqlite.prepare("UPDATE usuarios SET actualizado_en = '2000-01-01'").run()
  const antes = env.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM historico_peso').get() as { n: number }

  const igual = await postPeso(ctx(env, new Request('https://nutri.trujillomingorance.com/api/peso', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'If-Match': `"${hash}"`, 'X-Sync-Prioridad': 'alta' },
    body: JSON.stringify(body),
  }), sesion))
  assert.equal(igual.status, 304)
  const despues = env.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM historico_peso').get() as { n: number }
  const usuario = env.DB.sqlite.prepare('SELECT actualizado_en FROM usuarios').get() as { actualizado_en: string }
  assert.equal(despues.n, antes.n)
  assert.equal(usuario.actualizado_en, '2000-01-01')
})
