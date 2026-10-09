/**
 * Subida de la foto al API Gateway.
 * El ticket sale de Pages (cookie o Bearer de la app). Aquí no hay secreto de Vite.
 */
import type { PlatoEscaneo } from './platoEscaneo.ts'
import { API_BASE } from './plataforma.ts'
import { URL_VISION, urlVisionPermitida } from '../../functions/utils/ticketVision.ts'

export type PreparadoVision =
  | { ok: true; modo: 'cache'; plato: PlatoEscaneo }
  | { ok: true; modo: 'gateway'; ticket: string; exp: number; url: string }
  | { ok: true; modo: 'local' }

function hostDe(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

/** La pasarela solo cuando la base es el gateway. Un VITE_API_URL local se queda en Pages. */
export function usarPasarelaVision(): boolean {
  return hostDe(API_BASE) === 'api.trujillomingorance.com'
}

export async function sha256Imagen(blob: Blob): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function enviarVision(url: string, ticket: string, imagen: Blob): Promise<Response> {
  if (!urlVisionPermitida(url) || url !== URL_VISION) throw new Error('pasarela')
  return fetch(url, {
    method: 'POST',
    mode: 'cors',
    credentials: 'omit',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${ticket}`,
      'content-type': imagen.type || 'application/octet-stream',
    },
    body: imagen,
  })
}
