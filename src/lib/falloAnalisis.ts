/**
 * Traduce un fallo del análisis de comida a lo que pinta la hoja.
 * Los textos de los cuatro casos de la visión son fijos.
 */
export const MENSAJE_PESO = 'La imagen excede el límite permitido. La hemos reajustado, intenta tomarla de nuevo'
export const MENSAJE_LIMITE = 'Se ha alcanzado el límite de análisis simultáneos.'
export const MENSAJE_LIMITE_LARGO = 'Estamos gestionando un alto volumen de comidas. Inténtalo en 2 minutos.'
export const MENSAJE_AUTH = 'Incidencia temporal en la infraestructura de IA. Nuestro equipo ya ha sido notificado.'
export const MENSAJE_RED = 'La conexión tardó demasiado. Comprueba tu cobertura móvil y vuelve a pulsar.'
export const TITULO_PESO = 'Imagen demasiado grande'
export const TITULO_LIMITE = 'Servicio temporalmente saturado'
export const TITULO_AUTH = 'Incidencia temporal'
export const TITULO_RED = 'Conexión lenta'

export type CodigoFalloUi = 'PAYLOAD_TOO_LARGE' | 'RATE_LIMIT_EXCEEDED' | 'AUTH_FAILURE' | 'UPSTREAM_TIMEOUT' | 'FOTO' | 'OTRO'

export interface FalloAnalisisUi {
  codigo: CodigoFalloUi
  titulo?: string
  mensaje: string
  /** Reintento con espera creciente. */
  reintentar: boolean
  /** Los fallos de red se relanzan solos. El límite, solo si la espera cabe en 3 minutos. */
  auto: boolean
  /** Segundos de la cuenta atrás, cuando el reintento es automático. */
  esperaSeg?: number
  manual: boolean
  elegirOtra: boolean
}

const base = (parcial: Partial<FalloAnalisisUi> & Pick<FalloAnalisisUi, 'codigo' | 'mensaje'>): FalloAnalisisUi => ({
  titulo: '',
  reintentar: false,
  auto: false,
  manual: false,
  elegirOtra: false,
  ...parcial,
})

interface ErrorConCodigo extends Error {
  status?: number
  codigo?: string
  errorCode?: string
  reintentarEn?: number
}

/** ApiError y ErrorImagen se reconocen por el nombre: este módulo no importa la API. */
function conCodigo(e: unknown, nombre: string): ErrorConCodigo | null {
  if (!(e instanceof Error) || e.name !== nombre) return null
  return e as ErrorConCodigo
}

export function falloDeAnalisis(e: unknown): FalloAnalisisUi {
  const imagen = conCodigo(e, 'ErrorImagen')
  if (imagen?.codigo === 'pesada') {
    return base({ codigo: 'PAYLOAD_TOO_LARGE', titulo: TITULO_PESO, mensaje: MENSAJE_PESO, reintentar: true, elegirOtra: true })
  }
  if (imagen) {
    return base({ codigo: 'OTRO', mensaje: imagen.message, manual: true, elegirOtra: true })
  }
  const api = conCodigo(e, 'ApiError')
  if (api && typeof api.status === 'number') {
    if (api.errorCode === 'PAYLOAD_TOO_LARGE' || api.status === 413) {
      return base({ codigo: 'PAYLOAD_TOO_LARGE', titulo: TITULO_PESO, mensaje: MENSAJE_PESO, reintentar: true, elegirOtra: true })
    }
    if (api.errorCode === 'FORMATO' || api.status === 415 || (api.status === 400 && /formato|webp|jpeg|png/i.test(api.message))) {
      return base({ codigo: 'OTRO', mensaje: api.message, elegirOtra: true })
    }
    if (api.errorCode === 'RATE_LIMIT_EXCEEDED' || api.errorCode === 'AI_RATE_LIMIT' || api.status === 429) {
      const segundos = typeof api.reintentarEn === 'number' && api.reintentarEn > 0 ? Math.round(api.reintentarEn) : 120
      const corto = segundos <= 180
      return base({
        codigo: 'RATE_LIMIT_EXCEEDED',
        titulo: TITULO_LIMITE,
        mensaje: corto ? MENSAJE_LIMITE : api.message || MENSAJE_LIMITE_LARGO,
        auto: corto,
        esperaSeg: corto ? segundos : undefined,
        reintentar: true,
        manual: !corto,
      })
    }
    if (api.errorCode === 'AUTH_FAILURE') {
      return base({ codigo: 'AUTH_FAILURE', titulo: TITULO_AUTH, mensaje: MENSAJE_AUTH })
    }
    if (api.status === 401) {
      return base({ codigo: 'OTRO', mensaje: 'Tu sesión ha caducado. Vuelve a entrar.' })
    }
    if (api.status === 403) {
      return base({ codigo: 'OTRO', mensaje: api.message, manual: false })
    }
    if (api.status === 422 || api.codigo === 'foto_no_distinguida') {
      return base({ codigo: 'FOTO', mensaje: api.message, manual: true, elegirOtra: true })
    }
    if (api.errorCode === 'UPSTREAM_TIMEOUT' || api.status === 0 || api.status === 504 || api.status >= 500) {
      return base({ codigo: 'UPSTREAM_TIMEOUT', titulo: TITULO_RED, mensaje: MENSAJE_RED, reintentar: true, auto: true, manual: true })
    }
    return base({ codigo: 'OTRO', mensaje: api.message, reintentar: true, manual: true })
  }
  return base({
    codigo: 'UPSTREAM_TIMEOUT',
    titulo: TITULO_RED,
    mensaje: e instanceof Error && e.message ? e.message : MENSAJE_RED,
    reintentar: true,
    auto: true,
    manual: true,
  })
}
