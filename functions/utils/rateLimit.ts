/**
 * Rate limiting en D1 con ventana fija y upsert ATÓMICO (una sola sentencia):
 * dos peticiones simultáneas nunca leen el mismo contador.
 */
import type { Env } from './env.ts'
import { purgarCheckpoints } from './turso.ts'
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

export interface OpcionesLimite {
  /** Al llegar a max × factorPico en la misma ventana se bloquea la clave. */
  factorPico?: number
  /** Duración del bloqueo por pico, en segundos. Por defecto 1 h. */
  bloqueoSeg?: number
  mensajeBloqueo?: string
}

async function bloqueoActivo(env: Env, clave: string, ahora: number): Promise<number | null> {
  const fila = await env.DB.prepare('SELECT ventana_inicio AS hasta FROM rate_limits WHERE clave = ?1').bind(`bloqueo:${clave}`).first<{ hasta: number }>()
  if (!fila || fila.hasta <= ahora) return null
  return fila.hasta
}

/** Marca un bloqueo temporal en la misma tabla de ventanas (clave distinta, no la pisa limitar()). */
async function activarBloqueo(env: Env, clave: string, hasta: number) {
  await env.DB.prepare(
    `INSERT INTO rate_limits (clave, ventana_inicio, contador) VALUES (?1, ?2, 1)
     ON CONFLICT (clave) DO UPDATE SET ventana_inicio = excluded.ventana_inicio, contador = rate_limits.contador + 1`,
  )
    .bind(`bloqueo:${clave}`, hasta)
    .run()
}

/**
 * Igual que limitar() pero lanza 429 con Retry-After si se supera.
 * Con `factorPico`, un pico (seguír golpeando tras el límite) deja la clave
 * bloqueada aunque empiece otra ventana, hasta que pase `bloqueoSeg`.
 */
export async function exigirLimite(env: Env, clave: string, max: number, ventanaSeg: number, mensaje?: string, opciones?: OpcionesLimite) {
  const ahora = Math.floor(Date.now() / 1000)
  if (opciones?.factorPico) {
    const hasta = await bloqueoActivo(env, clave, ahora)
    if (hasta) {
      const espera = Math.max(1, hasta - ahora)
      throw new HttpError(
        429,
        opciones.mensajeBloqueo ?? 'Actividad anómala. Inténtalo más tarde.',
        { codigo: 'bloqueado', reintentarEn: espera },
        { 'Retry-After': String(espera) },
      )
    }
  }
  const r = await limitar(env, clave, max, ventanaSeg)
  if (opciones?.factorPico && r.contador >= max * opciones.factorPico) {
    await activarBloqueo(env, clave, ahora + (opciones.bloqueoSeg ?? 3600))
  }
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
      env.DB.prepare('DELETE FROM tokens_app WHERE expira_en < ?1').bind(ahora - 86400),
      env.DB.prepare('DELETE FROM codigos_login WHERE expira_en < ?1').bind(ahora - 86400),
      env.DB.prepare('DELETE FROM emparejamientos_qr WHERE expira_en < ?1').bind(ahora - 3600),
      env.DB.prepare('DELETE FROM sesiones_web WHERE expira_en < ?1').bind(ahora - 86400),
    ])
    // Aparte: si la migración 0004 aún no está aplicada, no debe tumbar la limpieza anterior.
    // Se conserva una semana tras caducar (copia de emergencia si OFF no responde).
    await env.DB.prepare('DELETE FROM cache_off WHERE expira_en < ?1').bind(ahora - 7 * 86400).run().catch(() => {})
    await purgarCheckpoints(env, ahora).catch(() => {})
  } catch (e) {
    console.warn('[limpieza] fallo no bloqueante', e)
  }
}
