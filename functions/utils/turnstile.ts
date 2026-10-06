/**
 * Verificación de Cloudflare Turnstile en servidor (siteverify).
 * https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */
import { esProduccion, type Env } from './env.ts'
import { HttpError } from './response.ts'

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

/** Claves de PRUEBA oficiales (solo desarrollo). */
export const TURNSTILE_TEST = {
  siteKey: '1x00000000000000000000AA',
  secretPasa: '1x0000000000000000000000000000000AA',
  secretFalla: '2x0000000000000000000000000000000AA',
} as const

function secreto(env: Env): string {
  const s = env.TURNSTILE_SECRET_KEY?.trim()
  if (esProduccion(env)) {
    // Fallar cerrado: en producción nunca sin secreto ni con claves de prueba.
    if (!s || /^[123]x0{20,}/.test(s)) {
      console.error('[turnstile] TURNSTILE_SECRET_KEY ausente o de prueba en producción')
      throw new HttpError(500, 'Error de configuración del servidor.')
    }
    return s
  }
  return s || TURNSTILE_TEST.secretPasa
}

export interface ResultadoTurnstile {
  success: boolean
  'error-codes'?: string[]
  hostname?: string
  action?: string
}

export async function verificarTurnstile(env: Env, token: string | null | undefined, ip?: string): Promise<boolean> {
  if (!token || token.length > 4096) return false
  const body = new FormData()
  body.append('secret', secreto(env))
  body.append('response', token)
  if (ip && ip !== '0.0.0.0') body.append('remoteip', ip)
  body.append('idempotency_key', crypto.randomUUID())
  try {
    const res = await fetch(SITEVERIFY, { method: 'POST', body, signal: AbortSignal.timeout(8000) })
    if (!res.ok) {
      console.warn('[turnstile] siteverify HTTP', res.status)
      return false
    }
    const data = (await res.json()) as ResultadoTurnstile
    if (!data.success) console.info('[turnstile] rechazado', data['error-codes'])
    return data.success === true
  } catch (e) {
    console.warn('[turnstile] error de red', e)
    return false // fallar cerrado
  }
}
