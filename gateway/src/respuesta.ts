/** JSON de error que ya entiende FalloAnalisis. Sin claves ni pila. */
import { MENSAJE_LIMITE, MENSAJE_RED, TITULO_LIMITE, TITULO_RED } from '../../functions/utils/errorVision.ts'

export interface CuerpoError {
  code: string
  status: number
  user_title: string
  user_message: string
  retry_after_seconds: number
}

export function respuestaJson(status: number, cuerpo: unknown, extra?: HeadersInit): Response {
  const headers = new Headers(extra)
  headers.set('content-type', 'application/json; charset=utf-8')
  return new Response(JSON.stringify(cuerpo), { status, headers })
}

export function jsonFallo(status: number, error: CuerpoError, codigo: string, headers?: HeadersInit): Response {
  return respuestaJson(status, { ok: false, success: false, error, codigo }, headers)
}

export function falloLimite(): Response {
  return jsonFallo(
    429,
    {
      code: 'RATE_LIMIT_EXCEEDED',
      status: 429,
      user_title: TITULO_LIMITE,
      user_message: MENSAJE_LIMITE,
      retry_after_seconds: 60,
    },
    'rate_limit_exceeded',
    { 'retry-after': '60' },
  )
}

export function falloFormato(mensaje = 'Formato no soportado. Usa JPEG, PNG o WebP.'): Response {
  return jsonFallo(
    400,
    { code: 'FORMATO', status: 400, user_title: 'Formato no soportado', user_message: mensaje, retry_after_seconds: 0 },
    'formato',
  )
}

export function falloTicket(): Response {
  return jsonFallo(
    400,
    {
      code: 'TICKET',
      status: 400,
      user_title: 'Vuelve a intentar',
      user_message: 'El permiso de análisis ha caducado. Vuelve a pulsar.',
      retry_after_seconds: 0,
    },
    'ticket',
  )
}

export function falloCliente(): Response {
  return jsonFallo(
    403,
    {
      code: 'CLIENTE',
      status: 403,
      user_title: 'Cliente no permitido',
      user_message: 'Cliente no permitido.',
      retry_after_seconds: 0,
    },
    'cliente',
  )
}

export function falloOrigen(): Response {
  return jsonFallo(
    403,
    {
      code: 'ORIGEN',
      status: 403,
      user_title: 'Origen no permitido',
      user_message: 'Origen no permitido.',
      retry_after_seconds: 0,
    },
    'origen',
  )
}

export function falloUpstream(status = 500): Response {
  return jsonFallo(
    status,
    {
      code: 'UPSTREAM_TIMEOUT',
      status,
      user_title: TITULO_RED,
      user_message: MENSAJE_RED,
      retry_after_seconds: 0,
    },
    'upstream_timeout',
  )
}
