/**
 * Ticket corto para POST https://api.trujillomingorance.com/v1/nutrifit/vision.
 * El propósito HMAC no es el de la sesión: una cookie __Host-nf_session no vale aquí.
 * La caducidad la mira quien verifica. firmar() solo garantiza la firma.
 */
export const PROPOSITO_VISION = 'vision-gateway'
export const TTL_TICKET_VISION_S = 60
export const URL_VISION = 'https://api.trujillomingorance.com/v1/nutrifit/vision'

/** Mismos topes que POST /api/alimentos/escanear. El gateway añade 5/min encima. */
export const CUPOS_ESCANEO = {
  porMinuto: 8,
  porDia: 10,
  porHora: 20,
} as const

export interface PayloadTicketVision {
  sub: string
  exp: number
  img: string
}

/** La URL de entorno solo puede apuntar a este host. El path lo fija el código. */
export function pasarelaVisionActiva(url: string | undefined, hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '127.0.0.1') return false
  const bruto = (url ?? '').trim()
  if (!bruto) return false
  try {
    const u = new URL(bruto)
    return u.protocol === 'https:' && u.hostname === 'api.trujillomingorance.com'
  } catch {
    return false
  }
}

/** El cliente solo puede enviar la foto a la ruta fija. Otra URL se rechaza. */
export function urlVisionPermitida(url: string): boolean {
  try {
    const u = new URL(url)
    const fija = new URL(URL_VISION)
    return u.protocol === fija.protocol && u.hostname === fija.hostname && u.pathname === fija.pathname && u.search === '' && u.username === '' && u.password === ''
  } catch {
    return false
  }
}

export function payloadTicketValido(p: unknown, ahoraSeg: number): p is PayloadTicketVision {
  if (!p || typeof p !== 'object') return false
  const o = p as Record<string, unknown>
  if (typeof o.sub !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(o.sub)) return false
  if (typeof o.exp !== 'number' || !Number.isInteger(o.exp)) return false
  if (o.exp < ahoraSeg - 5) return false
  if (o.exp > ahoraSeg + TTL_TICKET_VISION_S + 30) return false
  if (typeof o.img !== 'string' || !/^[a-f0-9]{64}$/.test(o.img)) return false
  return true
}
