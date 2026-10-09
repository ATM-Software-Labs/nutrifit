/**
 * La IP del visitante, firmada por el gateway con AUTH_SECRET.
 * Pages solo la cree si la firma cuadra. Un cliente no puede inventarla.
 */
import { firmar, verificarFirma } from './crypto.ts'

export const PROPOSITO_IP_PASARELA = 'client-ip'
export const CABECERA_VIA = 'x-nf-via'
export const CABECERA_FIRMA_IP = 'x-nf-client-sig'

export function ipPresentable(ip: string): boolean {
  return ip.length > 0 && ip.length <= 64 && !/[\s,]/.test(ip)
}

export async function firmarIpCliente(secreto: string, ip: string, ahora = Math.floor(Date.now() / 1000)): Promise<string> {
  return firmar(secreto, PROPOSITO_IP_PASARELA, { ip, exp: ahora + 60 })
}

export async function leerIpFirmada(secreto: string | undefined, request: Request, ahora = Math.floor(Date.now() / 1000)): Promise<string | null> {
  if (!secreto) return null
  if (request.headers.get(CABECERA_VIA) !== 'gateway') return null
  const token = request.headers.get(CABECERA_FIRMA_IP)
  if (!token) return null
  const payload = await verificarFirma<{ ip?: unknown; exp?: unknown }>(secreto, PROPOSITO_IP_PASARELA, token)
  if (!payload || typeof payload.ip !== 'string' || typeof payload.exp !== 'number') return null
  if (!ipPresentable(payload.ip)) return null
  if (payload.exp < ahora - 5 || payload.exp > ahora + 120) return null
  return payload.ip
}
