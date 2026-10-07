/**
 * Verificación de Cloudflare Turnstile en servidor (siteverify).
 * https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 *
 * El cuerpo lleva secret, response (el token) y remoteip (la IP del visitante;
 * siteverify no tiene un campo ip_address). Si success es false, el hostname
 * no es de esta app, o llega un score por debajo del umbral, el middleware
 * responde 403.
 */
import { esProduccion, type Env } from './env.ts'
import { HttpError } from './response.ts'
import { scoreAnomalo } from './bot.ts'

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
  /** No forma parte del siteverify público. Si algún día viene, se trata como bot score. */
  score?: number
}

/** Hosts donde el widget puede haberse resuelto: la app, los orígenes extra y el WebView. */
export function hostnamesTurnstile(env: Env): Set<string> | null {
  if (!esProduccion(env)) return null
  const hosts = new Set<string>(['localhost'])
  const anadir = (origen: string | undefined) => {
    if (!origen) return
    try {
      hosts.add(new URL(origen).hostname)
    } catch {
      /* origen mal formado: se ignora */
    }
  }
  anadir(env.APP_URL)
  for (const o of (env.ALLOWED_ORIGINS ?? '').split(',')) anadir(o.trim())
  if (hosts.size === 1) hosts.add('nutri.trujillomingorance.com')
  return hosts
}

/** true solo con success, hostname permitido y score (si viene) por encima del umbral. */
export function aceptaTurnstile(data: ResultadoTurnstile, hostnames: Set<string> | null): boolean {
  if (data.success !== true) return false
  if (scoreAnomalo(data.score)) return false
  if (hostnames && data.hostname && !hostnames.has(data.hostname)) return false
  return true
}

export async function verificarTurnstile(env: Env, token: string | null | undefined, ip?: string): Promise<boolean> {
  if (!token || token.length > 2048) return false
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
    return aceptaTurnstile(data, hostnamesTurnstile(env))
  } catch {
    return false // fallar cerrado; el error de red no se vuelca (puede arrastrar la URL con el secreto)
  }
}
