/**
 * Rate limiting en D1 con ventana fija y upsert ATÓMICO (una sola sentencia):
 * dos peticiones simultáneas nunca leen el mismo contador.
 */
import type { Env } from './env.ts'
import { HttpError } from './response.ts'
import { sha256Hex } from './crypto.ts'

export interface ResultadoLimite {
  permitido: boolean
  contador: number
  restante: number
  reintentarEn: number // segundos hasta el fin de la ventana
}

const SQL_LIMITE = `
INSERT INTO rate_limits (clave, ventana_inicio, contador) VALUES (?1, ?2, 1)
ON CONFLICT (clave) DO UPDATE SET
  contador = CASE WHEN rate_limits.ventana_inicio = excluded.ventana_inicio
                  THEN rate_limits.contador + 1 ELSE 1 END,
  ventana_inicio = excluded.ventana_inicio
RETURNING contador, ventana_inicio`

/**
 * Incrementa y comprueba el contador de `clave` en una ventana de `ventanaSeg`.
 * @example const r = await limitar(env, `auth:ip:${ip}`, 5, 900)
 */
export async function limitar(env: Env, clave: string, max: number, ventanaSeg: number): Promise<ResultadoLimite> {
  const ahora = Math.floor(Date.now() / 1000)
  const ventana = Math.floor(ahora / ventanaSeg) * ventanaSeg
  const fila = await env.DB.prepare(SQL_LIMITE)
    .bind(clave, ventana)
    .first<{ contador: number; ventana_inicio: number }>()
  const contador = fila?.contador ?? 1
  return {
    permitido: contador <= max,
    contador,
    restante: Math.max(0, max - contador),
    reintentarEn: ventana + ventanaSeg - ahora,
  }
}

/** Igual que limitar() pero lanza 429 con Retry-After si se supera. */
export async function exigirLimite(env: Env, clave: string, max: number, ventanaSeg: number, mensaje?: string) {
  const r = await limitar(env, clave, max, ventanaSeg)
  if (!r.permitido) {
    throw new HttpError(
      429,
      mensaje ?? 'Demasiadas peticiones. Espera un momento y vuelve a intentarlo.',
      { reintentarEn: r.reintentarEn },
      { 'Retry-After': String(r.reintentarEn) },
    )
  }
  return r
}

/** Clave anónima (no guardamos IPs ni emails en claro en rate_limits). */
export async function claveLimite(prefijo: string, valor: string): Promise<string> {
  return `${prefijo}:${(await sha256Hex(valor.toLowerCase())).slice(0, 32)}`
}

/** Limpieza oportunista de ventanas viejas y tokens caducados (llamar con waitUntil). */
export async function limpiezaOportunista(env: Env, probabilidad = 0.02) {
  if (Math.random() > probabilidad) return
  const ahora = Math.floor(Date.now() / 1000)
  try {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM rate_limits WHERE ventana_inicio < ?1').bind(ahora - 2 * 86400),
      env.DB.prepare('DELETE FROM magic_tokens WHERE expira_en < ?1').bind(ahora - 86400),
    ])
  } catch (e) {
    console.warn('[limpieza] fallo no bloqueante', e)
  }
}
