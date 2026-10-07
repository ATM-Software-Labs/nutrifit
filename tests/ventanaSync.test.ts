import { test } from 'node:test'
import assert from 'node:assert/strict'
import { onRequestPost as postAgua } from '../functions/api/agua.ts'
import { onRequestPost as postPeso } from '../functions/api/peso.ts'
import {
  ANCHO_VENTANA_MIN,
  JITTER_MIN,
  MINUTOS_DIA,
  dentroDeVentana,
  enVentana,
  msHastaVentana,
  reloj,
  ventanaDeUsuario,
} from '../functions/utils/ventanaSync.ts'
import { ctx, entornoTest } from './d1Sqlite.ts'

test('el hash reparte un minuto del día con jitter estable de ±15', async () => {
  const a = await ventanaDeUsuario('usuario-a')
  const b = await ventanaDeUsuario('usuario-a')
  const c = await ventanaDeUsuario('usuario-b')
  assert.deepEqual(a, b)
  assert.ok(a.ancla >= 0 && a.ancla < MINUTOS_DIA)
  assert.ok(a.jitter >= -JITTER_MIN && a.jitter <= JITTER_MIN)
  assert.equal(a.inicio, (a.ancla + a.jitter + MINUTOS_DIA) % MINUTOS_DIA)
  assert.ok(a.segundo >= 0 && a.segundo < 60)
  assert.notEqual(a.inicio, c.inicio)
})

test('la ventana de 30 minutos cruza la medianoche', () => {
  assert.equal(enVentana(10, 1430, ANCHO_VENTANA_MIN), true)
  assert.equal(enVentana(1429, 1430, ANCHO_VENTANA_MIN), false)
  assert.equal(enVentana(0, 0, ANCHO_VENTANA_MIN), true)
  assert.equal(enVentana(30, 0, ANCHO_VENTANA_MIN), false)
})

test('la espera hasta la ventana no salta un día cuando falta menos de un segundo', async () => {
  const ahora = new Date('2026-06-15T10:00:59.500Z')
  const { minuto, segundo } = reloj(ahora)
  let id = ''
  let segundoInicio = 0
  for (let i = 0; i < 6000; i++) {
    const candidato = `espera-${i}`
    const v = await ventanaDeUsuario(candidato)
    if (v.inicio === (minuto + 1) % MINUTOS_DIA) {
      id = candidato
      segundoInicio = v.segundo
      break
    }
  }
  assert.ok(id, 'hace falta un id cuya ventana empiece en el minuto siguiente')
  const ms = await msHastaVentana(id, ahora)
  const esperado = ((60 - segundo) + segundoInicio) * 1000 - 500
  assert.equal(ms, esperado)
  assert.ok(ms < 120_000)
})

test('fuera de la ventana un POST normal no escribe; la prioridad alta sí', async () => {
  const ahora = new Date()
  let id = ''
  for (let i = 0; i < 400; i++) {
    const candidato = `fuera-${i}`
    if (!(await dentroDeVentana(candidato, ahora))) {
      id = candidato
      break
    }
  }
  assert.ok(id)
  const env = entornoTest()
  env.DB.sqlite.prepare('INSERT INTO usuarios (id, email) VALUES (?1, ?2)').run(id, 'a@b.es')
  const sesion = { usuarioId: id, email: 'a@b.es' }
  const body = JSON.stringify({ fecha: '2026-10-06', ml: 500, modo: 'fijar' })
  const aplazado = await postAgua(ctx(env, new Request('https://nutri.trujillomingorance.com/api/agua', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  }), sesion))
  assert.equal(aplazado.status, 202)
  const cuerpo = await aplazado.json() as { ok: boolean; aplazado: boolean }
  assert.equal(cuerpo.ok, true)
  assert.equal(cuerpo.aplazado, true)
  const aguaVacia = env.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM registro_agua').get() as { n: number }
  assert.equal(aguaVacia.n, 0)

  const peso = await postPeso(ctx(env, new Request('https://nutri.trujillomingorance.com/api/peso', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ peso: 71, fecha: '2026-10-06' }),
  }), sesion))
  assert.equal(peso.status, 202)
  const pesosVacios = env.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM historico_peso').get() as { n: number }
  assert.equal(pesosVacios.n, 0)

  const alta = await postAgua(ctx(env, new Request('https://nutri.trujillomingorance.com/api/agua', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Sync-Prioridad': 'alta' },
    body,
  }), sesion))
  assert.equal(alta.status, 200)
  const fila = env.DB.sqlite.prepare('SELECT ml FROM registro_agua').get() as { ml: number }
  assert.equal(fila.ml, 500)
})
