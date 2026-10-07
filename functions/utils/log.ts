/**
 * Una línea JSON por evento de seguridad. Solo estos campos: no hay sitio
 * para email, código, token, cuerpo ni cabeceras.
 * client_ip es un HMAC diario (no reversible, cambia cada día UTC).
 */
import { hmacSha256 } from './crypto.ts'

export const TIPOS_EVENTO = ['auth_attempt', 'quota_exceeded', 'sql_error'] as const
export type TipoEvento = (typeof TIPOS_EVENTO)[number]

export interface EventoLog {
  timestamp: string
  client_ip: string
  endpoint: string
  method: string
  latencia_ms: number
  status_code: number
  event_type: TipoEvento
}

const METODOS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])

/** Ruta sin query ni host: un magic link no puede colar el token en el log. */
export function endpointLimpio(ruta: string): string {
  const sinQuery = (ruta.split('?')[0] ?? '/').split('#')[0] ?? '/'
  let path = sinQuery
  if (path.startsWith('http://') || path.startsWith('https://')) {
    try {
      path = new URL(path).pathname
    } catch {
      path = '/'
    }
  }
  if (!path.startsWith('/')) path = `/${path}`
  return path.slice(0, 200)
}

/** 8 bytes de HMAC en hex. El día UTC va en la entrada, así el hash no es eterno. */
export async function hashIp(secreto: string, ip: string, dia: string): Promise<string> {
  const mac = await hmacSha256(secreto || 'nutrifit-log', 'log-ip', `${dia}\n${ip}`)
  return Array.from(mac.subarray(0, 8), (b) => b.toString(16).padStart(2, '0')).join('')
}

export function esErrorSql(e: unknown): boolean {
  if (!(e instanceof Error)) return false
  return e.name === 'D1Error' || /D1_ERROR|SqliteError|SQLITE_/i.test(e.name + ' ' + e.message)
}

export function tiposDeEvento(pathname: string, status: number, sql: boolean): TipoEvento[] {
  const tipos: TipoEvento[] = []
  if (pathname.startsWith('/api/auth/')) tipos.push('auth_attempt')
  if (status === 429) tipos.push('quota_exceeded')
  if (sql) tipos.push('sql_error')
  return tipos
}

/** Línea lista para el log de la plataforma. Ignora cualquier campo de más. */
export function formatearLog(e: EventoLog): string {
  const client_ip = /^[0-9a-f]{16}$/.test(e.client_ip) ? e.client_ip : 'invalid'
  const linea = {
    timestamp: e.timestamp,
    client_ip,
    endpoint: endpointLimpio(e.endpoint),
    method: METODOS.has(e.method) ? e.method : 'UNKNOWN',
    latencia_ms: Math.max(0, Math.round(e.latencia_ms)),
    status_code: e.status_code,
    event_type: e.event_type,
  }
  return JSON.stringify(linea)
}
