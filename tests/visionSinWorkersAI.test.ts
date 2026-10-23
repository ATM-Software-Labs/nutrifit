import { test } from 'node:test'
import assert from 'node:assert/strict'
import { workersAIVisionActivo, analizarImagen } from '../functions/utils/ia.ts'
import { orquestarEscaneo } from '../functions/utils/orquestadorVision.ts'
import { CUPOS_ESCANEO } from '../functions/utils/ticketVision.ts'
import type { Env } from '../functions/utils/env.ts'

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 0xff, 0xd9])

function envSinClaves(flag?: string): { env: Env; llamadas: () => number } {
  let n = 0
  const env = { AI: { run: async () => { n += 1; throw new Error('no') } }, VISION_WORKERS_AI: flag } as unknown as Env
  return { env, llamadas: () => n }
}

test('cupo diario del escáner: 20 por usuario', () => {
  assert.equal(CUPOS_ESCANEO.porDia, 20)
})

test('Workers AI del escáner apagado salvo VISION_WORKERS_AI="1"', () => {
  assert.equal(workersAIVisionActivo({}), false)
  assert.equal(workersAIVisionActivo({ VISION_WORKERS_AI: '0' }), false)
  assert.equal(workersAIVisionActivo({ VISION_WORKERS_AI: '1' }), true)
})

test('la cascada de la foto no llama a Workers AI por defecto', async () => {
  const fetchOriginal = globalThis.fetch
  globalThis.fetch = (async () => { throw new TypeError('sin red') }) as typeof fetch
  try {
    const a = envSinClaves()
    await assert.rejects(orquestarEscaneo(a.env, { bytes: JPEG, mime: 'image/jpeg' }))
    assert.equal(a.llamadas(), 0)
    const b = envSinClaves()
    await assert.rejects(analizarImagen(b.env, { bytes: JPEG, mime: 'image/jpeg' }))
    assert.equal(b.llamadas(), 0)
    const c = envSinClaves('1')
    await assert.rejects(orquestarEscaneo(c.env, { bytes: JPEG, mime: 'image/jpeg' }))
    assert.equal(c.llamadas(), 1)
  } finally {
    globalThis.fetch = fetchOriginal
  }
})

test('el respaldo no cobra dos veces con el ticket de la misma foto y usuario', async () => {
  const { firmar } = await import('../functions/utils/crypto.ts')
  const { ticketYaCobrado } = await import('../functions/utils/ticketCobrado.ts')
  const { PROPOSITO_VISION } = await import('../functions/utils/ticketVision.ts')
  const env = { GATEWAY_SECRET: 'g'.repeat(40) } as unknown as Env
  const img = 'a'.repeat(64)
  const exp = Math.floor(Date.now() / 1000) + 60
  const t = await firmar('g'.repeat(40), PROPOSITO_VISION, { sub: 'u1', exp, img })
  const req = (h?: string) => new Request('https://x/api/alimentos/escanear', { method: 'POST', headers: h ? { 'x-vision-ticket': h } : {} })
  assert.equal(await ticketYaCobrado(env, req(t), 'u1', `ia:${img}`), true)
  assert.equal(await ticketYaCobrado(env, req(t), 'u2', `ia:${img}`), false)
  assert.equal(await ticketYaCobrado(env, req(t), 'u1', `ia:${'b'.repeat(64)}`), false)
  assert.equal(await ticketYaCobrado(env, req(), 'u1', `ia:${img}`), false)
  const otro = await firmar('h'.repeat(40), PROPOSITO_VISION, { sub: 'u1', exp, img })
  assert.equal(await ticketYaCobrado(env, req(otro), 'u1', `ia:${img}`), false)
})
