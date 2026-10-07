import { test } from 'node:test'
import assert from 'node:assert/strict'
import { endpointLimpio, esErrorSql, formatearLog, hashIp, tiposDeEvento } from '../functions/utils/log.ts'
import { puntuacionBot, scoreAnomalo } from '../functions/utils/bot.ts'
import { aceptaTurnstile, hostnamesTurnstile } from '../functions/utils/turnstile.ts'
import type { Env } from '../functions/utils/env.ts'

test('el log es JSON con solo los campos de seguridad y sin la query', () => {
  const linea = formatearLog({
    timestamp: '2026-10-06T12:00:00.000Z',
    client_ip: 'a'.repeat(16),
    endpoint: '/api/auth/verificar?token=secreto&email=ana@ejemplo.es',
    method: 'GET',
    latencia_ms: 12.4,
    status_code: 302,
    event_type: 'auth_attempt',
  })
  const o = JSON.parse(linea) as Record<string, unknown>
  assert.deepEqual(Object.keys(o), ['timestamp', 'client_ip', 'endpoint', 'method', 'latencia_ms', 'status_code', 'event_type'])
  assert.equal(o.endpoint, '/api/auth/verificar')
  assert.equal(o.latencia_ms, 12)
  assert.equal(linea.includes('secreto'), false)
  assert.equal(linea.includes('ana@'), false)
})

test('una IP en claro no se acepta como client_ip', () => {
  const linea = formatearLog({
    timestamp: '2026-10-06T12:00:00.000Z',
    client_ip: '203.0.113.8',
    endpoint: '/api/auth/codigo',
    method: 'POST',
    latencia_ms: 1,
    status_code: 403,
    event_type: 'auth_attempt',
  })
  assert.equal(JSON.parse(linea).client_ip, 'invalid')
  assert.equal(linea.includes('203.0.113.8'), false)
})

test('hashIp no contiene la IP y cambia con el día', async () => {
  const ip = '203.0.113.8'
  const a = await hashIp('s'.repeat(40), ip, '2026-10-06')
  const b = await hashIp('s'.repeat(40), ip, '2026-10-06')
  const c = await hashIp('s'.repeat(40), ip, '2026-10-07')
  assert.equal(a, b)
  assert.notEqual(a, c)
  assert.match(a, /^[0-9a-f]{16}$/)
  assert.equal(a.includes('203'), false)
})

test('tipos de evento y error SQL sin volcar el mensaje', () => {
  assert.deepEqual(tiposDeEvento('/api/auth/yo', 200, false), ['auth_attempt'])
  assert.deepEqual(tiposDeEvento('/api/comidas/guardar', 429, false), ['quota_exceeded'])
  assert.deepEqual(tiposDeEvento('/api/auth/codigo', 429, true), ['auth_attempt', 'quota_exceeded', 'sql_error'])
  assert.equal(tiposDeEvento('/api/agua', 200, false).length, 0)
  assert.equal(esErrorSql(new Error('D1_ERROR: no such table: usuarios')), true)
  assert.equal(esErrorSql(Object.assign(new Error('x'), { name: 'SqliteError' })), true)
  assert.equal(esErrorSql(new Error('GEMINI_API_KEY no configurada')), false)
  assert.equal(endpointLimpio('https://nutri.example/api/auth/token?token=abc'), '/api/auth/token')
})

test('score anómalo: 1–29 sí, ausente o humano no', () => {
  assert.equal(scoreAnomalo(1), true)
  assert.equal(scoreAnomalo(29), true)
  assert.equal(scoreAnomalo(30), false)
  assert.equal(scoreAnomalo(0), false)
  assert.equal(scoreAnomalo(null), false)
  assert.equal(puntuacionBot({}), null)
  assert.equal(puntuacionBot({ cf: { botManagement: { score: 12 } } }), 12)
  assert.equal(scoreAnomalo(puntuacionBot({ cf: { botManagement: { score: 12 } } })), true)
})

test('siteverify: success, hostname y score', () => {
  const hosts = new Set(['nutri.trujillomingorance.com', 'localhost'])
  assert.equal(aceptaTurnstile({ success: true, hostname: 'nutri.trujillomingorance.com' }, hosts), true)
  assert.equal(aceptaTurnstile({ success: true, hostname: 'localhost' }, hosts), true)
  assert.equal(aceptaTurnstile({ success: false, hostname: 'nutri.trujillomingorance.com' }, hosts), false)
  assert.equal(aceptaTurnstile({ success: true, hostname: 'evil.example' }, hosts), false)
  assert.equal(aceptaTurnstile({ success: true, hostname: 'nutri.trujillomingorance.com', score: 10 }, hosts), false)
  assert.equal(aceptaTurnstile({ success: true }, null), true)
  const env = { ENVIRONMENT: 'development', APP_URL: 'https://nutri.trujillomingorance.com' } as Env
  assert.equal(hostnamesTurnstile(env), null)
})
