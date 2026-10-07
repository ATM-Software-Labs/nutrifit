import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ESQUEMA_TURSO, aplazarHistoricoPeso, tursoConfigurado } from '../functions/utils/turso.ts'
import type { Env } from '../functions/utils/env.ts'

test('sin URL libsql ni token no se abre Turso', () => {
  assert.equal(tursoConfigurado({} as Env), false)
  assert.equal(tursoConfigurado({ TURSO_DATABASE_URL: '', TURSO_AUTH_TOKEN: 'x' } as Env), false)
  assert.equal(tursoConfigurado({ TURSO_DATABASE_URL: 'libsql://nutrifit.turso.io', TURSO_AUTH_TOKEN: '' } as Env), false)
  assert.equal(tursoConfigurado({ TURSO_DATABASE_URL: 'file:local.db', TURSO_AUTH_TOKEN: 'tok' } as Env), false)
  assert.equal(tursoConfigurado({ TURSO_DATABASE_URL: 'libsql://nutrifit-x.turso.io', TURSO_AUTH_TOKEN: 'tok' } as Env), true)
})

test('el esquema externo solo tiene historial, eventos y checkpoints', () => {
  for (const tabla of ['historico_peso', 'eventos', 'cache_off', 'catalogo_alimentos_cache']) {
    assert.match(ESQUEMA_TURSO, new RegExp(`CREATE TABLE IF NOT EXISTS ${tabla}`))
  }
  assert.doesNotMatch(ESQUEMA_TURSO, /usuarios|diario_comidas|registro_agua|sesiones_web|rate_limits|tokens_app/)
})

test('sin Turso el historial de peso no se aplaza', () => {
  let aplazado = false
  const ok = aplazarHistoricoPeso(
    { env: {} as Env, waitUntil() { aplazado = true } },
    { id: 'p1', usuarioId: 'u1', peso: 70, fecha: '2026-10-06' },
  )
  assert.equal(ok, false)
  assert.equal(aplazado, false)
})
