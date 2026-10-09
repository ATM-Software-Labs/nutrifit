/**
 * Fallos de la visión de comida, vistos por el cliente.
 * El estado HTTP del proveedor se queda en el log. La respuesta solo lleva
 * un objeto de error fijo. Un 401 del proveedor sale como 403: un 401 en
 * esta API cierra la sesión.
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import { FotoIlegible, MENSAJE_FOTO_ILEGIBLE } from './iaParseo.ts'
import { error, HttpError } from './response.ts'

export const CODIGOS_FALLO_IA = ['RATE_LIMIT_EXCEEDED', 'PAYLOAD_TOO_LARGE', 'AUTH_FAILURE', 'UPSTREAM_TIMEOUT'] as const
export type CodigoFalloIA = (typeof CODIGOS_FALLO_IA)[number]

export const MENSAJE_LIMITE = 'Estamos gestionando un alto volumen de comidas. Inténtalo en 2 minutos.'
export const MENSAJE_PESO = 'La imagen excede el límite permitido. La hemos reajustado, intenta tomarla de nuevo'
export const MENSAJE_AUTH = 'Incidencia temporal en la infraestructura de IA. Nuestro equipo ya ha sido notificado.'
export const MENSAJE_RED = 'La conexión tardó demasiado. Comprueba tu cobertura móvil y vuelve a pulsar.'
export const TITULO_LIMITE = 'Servicio temporalmente saturado'
export const TITULO_PESO = 'Imagen demasiado grande'
export const TITULO_AUTH = 'Incidencia temporal'
export const TITULO_RED = 'Conexión lenta'

const MENSAJES: Record<CodigoFalloIA, string> = {
  RATE_LIMIT_EXCEEDED: MENSAJE_LIMITE,
  PAYLOAD_TOO_LARGE: MENSAJE_PESO,
  AUTH_FAILURE: MENSAJE_AUTH,
  UPSTREAM_TIMEOUT: MENSAJE_RED,
}

const TITULOS: Record<CodigoFalloIA, string> = {
  RATE_LIMIT_EXCEEDED: TITULO_LIMITE,
  PAYLOAD_TOO_LARGE: TITULO_PESO,
  AUTH_FAILURE: TITULO_AUTH,
  UPSTREAM_TIMEOUT: TITULO_RED,
}

/** Estado que ve el cliente. El 401 del proveedor no se reenvía. */
const ESTADO: Record<CodigoFalloIA, number> = {
  RATE_LIMIT_EXCEEDED: 429,
  PAYLOAD_TOO_LARGE: 413,
  AUTH_FAILURE: 403,
  UPSTREAM_TIMEOUT: 504,
}

const REINTENTO: Record<CodigoFalloIA, number> = {
  RATE_LIMIT_EXCEEDED: 120,
  PAYLOAD_TOO_LARGE: 0,
  AUTH_FAILURE: 0,
  UPSTREAM_TIMEOUT: 0,
}

export interface ErrorCliente {
  code: CodigoFalloIA | 'FORMATO' | 'FOTO_NO_DISTINGUIDA'
  status: number
  user_title: string
  user_message: string
  retry_after_seconds: number
}

export function codigoDeStatus(status: number): CodigoFalloIA {
  if (status === 429) return 'RATE_LIMIT_EXCEEDED'
  if (status === 413) return 'PAYLOAD_TOO_LARGE'
  if (status === 401 || status === 403) return 'AUTH_FAILURE'
  return 'UPSTREAM_TIMEOUT'
}

export function esCodigoFalloIA(v: unknown): v is CodigoFalloIA {
  return typeof v === 'string' && (CODIGOS_FALLO_IA as readonly string[]).includes(v)
}

function normalizarCodigo(v: unknown): CodigoFalloIA | null {
  if (v === 'AI_RATE_LIMIT') return 'RATE_LIMIT_EXCEEDED'
  return esCodigoFalloIA(v) ? v : null
}

/** Quita bearer, claves de Google y query secrets antes de escribir el log. */
export function mensajeLimpio(valor: string): string {
  return valor
    .replace(/Bearer\s+\S+/gi, 'Bearer [redactado]')
    .replace(/\bAIza[\w-]{8,}/g, '[redactado]')
    .replace(/([?&](?:key|token|api_key)=)[^&\s]+/gi, '$1[redactado]')
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, '[redactado]')
    .slice(0, 300)
}

/** Token corto. El cuerpo del proveedor no entra en el log. */
export function codigoProveedor(status: number, mensaje: string): string {
  const m = mensaje.toLowerCase()
  if (status === 429 || m.includes('rate limit') || m.includes('quota')) return 'rate_limit'
  if (status === 401 || status === 403 || m.includes('api key') || m.includes('unauthor') || m.includes('forbidden')) return 'auth'
  if (status === 413 || m.includes('payload') || m.includes('too large')) return 'payload'
  if (status === 503 || m.includes('overload') || m.includes('unavailable') || m.includes('capacity')) return 'model_overloaded'
  if (status === 504 || m.includes('timeout') || m.includes('aborted') || m.includes('timed out')) return 'timeout'
  return 'upstream'
}

interface ContextoVision {
  imageSizeBytes: number
  clientCountry: string
}

const contextoVision = new AsyncLocalStorage<ContextoVision>()

export function paisCliente(request: Request): string {
  const pais = request.cf?.country
  return typeof pais === 'string' && /^[A-Za-z]{2}$/.test(pais) ? pais.toUpperCase() : 'ZZ'
}

/** País y tamaño viajan con la petición. No se guardan la foto ni la IP. */
export function conContextoVision<T>(request: Request, imageSizeBytes: number, fn: () => Promise<T>): Promise<T> {
  return contextoVision.run({ imageSizeBytes: Math.max(0, imageSizeBytes), clientCountry: paisCliente(request) }, fn)
}

function emitirLog(info: { httpStatus: number; errorType: string; providerCode: string; latencyMs: number }): void {
  const ctx = contextoVision.getStore()
  console.warn(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      service: 'nutrifit-vision-proxy',
      http_status: info.httpStatus,
      error_type: info.errorType,
      provider_code: info.providerCode,
      latency_ms: Math.max(0, Math.round(info.latencyMs)),
      image_size_bytes: ctx?.imageSizeBytes ?? 0,
      client_country: ctx?.clientCountry ?? 'ZZ',
    }),
  )
}

export function registrarFalloProveedor(info: { proveedor: string; status: number | null; mensaje: string; latenciaMs: number }): void {
  const status = info.status ?? 0
  const mensaje = mensajeLimpio(info.mensaje)
  emitirLog({
    httpStatus: status,
    errorType: codigoDeStatus(status || 500),
    providerCode: codigoProveedor(status, mensaje),
    latencyMs: info.latenciaMs,
  })
}

interface FalloVisto {
  message: string
  codigo: CodigoFalloIA | null
  statusHttp: number | null
  latenciaMs: number | null
  proveedor: string | null
}

function leerFallo(e: unknown): FalloVisto | null {
  if (!e || typeof e !== 'object') return null
  const o = e as Record<string, unknown>
  if (typeof o.message !== 'string') return null
  return {
    message: o.message,
    codigo: normalizarCodigo(o.codigo),
    statusHttp: typeof o.statusHttp === 'number' ? o.statusHttp : null,
    latenciaMs: typeof o.latenciaMs === 'number' ? o.latenciaMs : null,
    proveedor: typeof o.proveedor === 'string' ? o.proveedor : null,
  }
}

export interface ResumenFallo {
  codigo: CodigoFalloIA
  mensaje: string
  statusHttp: number | null
  latenciaMs: number | null
  proveedor: string | null
}

/**
 * Entre varios proveedores caídos, elige lo que el usuario puede resolver:
 * peso, luego límite, luego autenticación solo si todos fallaron por eso.
 */
export function resumirFallos(errores: unknown[]): ResumenFallo {
  const vistos = errores.map(leerFallo).filter((f): f is FalloVisto => !!f)
  const codigos = vistos.map((f) => f.codigo)
  let codigo: CodigoFalloIA = 'UPSTREAM_TIMEOUT'
  if (codigos.includes('PAYLOAD_TOO_LARGE')) codigo = 'PAYLOAD_TOO_LARGE'
  else if (codigos.includes('RATE_LIMIT_EXCEEDED')) codigo = 'RATE_LIMIT_EXCEEDED'
  else if (vistos.length > 0 && vistos.every((f) => f.codigo === 'AUTH_FAILURE')) codigo = 'AUTH_FAILURE'
  const muestra = vistos.find((f) => f.codigo === codigo) ?? vistos[0]
  return {
    codigo,
    mensaje: muestra?.message ?? 'No se pudo analizar la imagen',
    statusHttp: muestra?.statusHttp ?? null,
    latenciaMs: muestra?.latenciaMs ?? null,
    proveedor: muestra?.proveedor ?? null,
  }
}

function detalle(codigo: CodigoFalloIA, mensaje = MENSAJES[codigo], retry = REINTENTO[codigo]): ErrorCliente {
  return {
    code: codigo,
    status: ESTADO[codigo],
    user_title: TITULOS[codigo],
    user_message: mensaje,
    retry_after_seconds: retry,
  }
}

/** Campos que viajan junto al 429 propio (cuota de NutriFit, no del proveedor). */
export function camposLimite(mensaje = MENSAJE_LIMITE): Record<string, unknown> {
  return { success: false, error: detalle('RATE_LIMIT_EXCEEDED', mensaje, 120), codigo: 'rate_limit_exceeded' }
}

function responder(status: number, cuerpo: ErrorCliente, codigo: string): Response {
  return error(status, cuerpo.user_message, { success: false, error: cuerpo, codigo })
}

function cuerpo(codigo: CodigoFalloIA): Response {
  const errorCliente = detalle(codigo)
  return responder(errorCliente.status, errorCliente, codigo.toLowerCase())
}

function esDefinitivo(e: unknown): boolean {
  return !!e && typeof e === 'object' && (e as { definitivo?: boolean }).definitivo === true
}

/**
 * Respuesta JSON del análisis. `null` deja pasar el error al middleware
 * (validación 400, sesión, Turnstile).
 */
export function respuestaFalloVision(e: unknown): Response | null {
  if (e instanceof FotoIlegible || (e instanceof Error && e.name === 'FotoIlegible') || esDefinitivo(e)) {
    return responder(
      422,
      {
        code: 'FOTO_NO_DISTINGUIDA',
        status: 422,
        user_title: 'Foto poco clara',
        user_message: MENSAJE_FOTO_ILEGIBLE,
        retry_after_seconds: 0,
      },
      'foto_no_distinguida',
    )
  }
  if (e instanceof HttpError) {
    if (e.status === 413) return cuerpo('PAYLOAD_TOO_LARGE')
    if (e.status === 415) {
      return responder(
        415,
        {
          code: 'FORMATO',
          status: 415,
          user_title: 'Formato no soportado',
          user_message: 'Formato no soportado. Usa JPEG, PNG o WebP.',
          retry_after_seconds: 0,
        },
        'formato',
      )
    }
    return null
  }
  const resumen = resumirFallos([e])
  emitirLog({
    httpStatus: ESTADO[resumen.codigo],
    errorType: resumen.codigo,
    providerCode: codigoProveedor(resumen.statusHttp ?? 0, mensajeLimpio(resumen.mensaje)),
    latencyMs: resumen.latenciaMs ?? 0,
  })
  return cuerpo(resumen.codigo)
}
