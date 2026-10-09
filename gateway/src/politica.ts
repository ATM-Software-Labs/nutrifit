/**
 * Filtros del borde. El origen no se refleja si no está en la lista y nunca es *.
 */
import { timingSafeEqual } from '../../functions/utils/crypto.ts'

export const MAX_VISION_BYTES = 300 * 1024
export const HSTS_GATEWAY = 'max-age=31536000; includeSubDomains'

const ORIGENES = new Set([
  'https://nutri.trujillomingorance.com',
  'https://nutrifit.trujillomingorance.com',
  'https://trujillomingorance.com',
  'https://nutrifit-ac9.pages.dev',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:8788',
  'http://127.0.0.1:8788',
  'https://localhost',
  'capacitor://localhost',
])

/** Origen cruzado permitido, o null si no hay que escribir Access-Control-Allow-Origin. */
export function origenPermitido(origin: string | null, selfOrigin: string): string | null {
  if (!origin || origin === selfOrigin) return null
  return ORIGENES.has(origin) ? origin : null
}

/** true si el navegador trae un Origin que no es el nuestro. Sin Origin no es CORS. */
export function origenRechazado(origin: string | null, selfOrigin: string): boolean {
  if (!origin || origin === selfOrigin) return false
  return !ORIGENES.has(origin)
}

/** curl, Postman y scrapers. Un User-Agent vacío también cuenta. */
export function esRastreador(ua: string | null): boolean {
  if (!ua || ua.trim().length < 8) return true
  return /curl\/|wget\/|python-requests|postmanruntime|scrapy\/|httpie\/|libwww-perl|go-http-client/i.test(ua)
}

/** same-origin, same-site o cross-site. `none` es una navegación, no un fetch del escáner. */
export function secFetchValido(valor: string | null): boolean {
  return valor === 'same-origin' || valor === 'same-site' || valor === 'cross-site'
}

export function aplicarCabecerasGateway(headers: Headers): void {
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('X-Frame-Options', 'DENY')
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  headers.set('Strict-Transport-Security', HSTS_GATEWAY)
  if (!headers.has('cache-control')) headers.set('Cache-Control', 'no-store')
}

export function aplicarCors(headers: Headers, origin: string): void {
  headers.set('Access-Control-Allow-Origin', origin)
  headers.set('Access-Control-Allow-Credentials', 'true')
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, CF-Turnstile-Token, If-None-Match, If-Match, X-Sync-Prioridad, X-App-Client-Token')
  headers.set('Access-Control-Expose-Headers', 'Retry-After, ETag, Content-Disposition')
  headers.set('Access-Control-Max-Age', '86400')
  headers.set('Vary', 'Origin')
}

/** Comparación de longitud fija. Un secreto ausente nunca autoriza. */
export function tokenInternoValido(presentado: string | null, secreto: string | undefined): boolean {
  if (!presentado || !secreto) return false
  if (presentado.length > 256 || secreto.length > 256) return false
  return timingSafeEqual(presentado, secreto)
}

export function ipDeGateway(request: Request): string {
  const cf = request.headers.get('cf-connecting-ip')?.trim() ?? ''
  if (cf.length > 0 && cf.length <= 64 && !/[\s,]/.test(cf)) return cf
  return 'desconocida'
}

export interface CupoVision {
  limit(opciones: { key: string }): Promise<{ success: boolean }>
}

/** false si alguna clave ya agotó las 5 peticiones del minuto. */
export async function dentroDelCupo(limite: CupoVision, claves: string[]): Promise<boolean> {
  for (const clave of claves) {
    const { success } = await limite.limit({ key: clave.slice(0, 120) })
    if (!success) return false
  }
  return true
}
