import { PROPOSITO_VISION, payloadTicketValido } from './ticketVision.ts'
import { verificarFirma } from './crypto.ts'
import { secretoPasarela } from './ipPasarela.ts'
import type { Env } from './env.ts'

/**
 * Respaldo tras la pasarela: el ticket de esta misma foto y usuario ya cobró el
 * cupo diario y el horario en /vision-ticket. Así un escaneo no cuenta dos veces.
 */
export async function ticketYaCobrado(env: Env, request: Request, usuarioId: string, clave: string): Promise<boolean> {
  const t = request.headers.get('x-vision-ticket')?.trim()
  const secreto = secretoPasarela(env)
  if (!t || t.length > 2048 || !secreto) return false
  const p = await verificarFirma<unknown>(secreto, PROPOSITO_VISION, t)
  if (!payloadTicketValido(p, Math.floor(Date.now() / 1000))) return false
  return p.sub === usuarioId && clave === `ia:${p.img}`
}
