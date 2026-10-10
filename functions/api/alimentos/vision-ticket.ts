/**
 * POST /api/alimentos/vision-ticket
 * Sesión + Turnstile + cuotas D1, y un ticket de 60 s para el gateway.
 * En localhost no hay pasarela: el cliente sigue en /api/alimentos/escanear.
 * La foto no viaja en esta petición. Solo su SHA-256, para la caché.
 */
import { firmar } from '../../utils/crypto.ts'
import type { Handler } from '../../utils/env.ts'
import { camposLimite, MENSAJE_LIMITE } from '../../utils/errorVision.ts'
import { leerJson } from '../../utils/http.ts'
import { leerPlatoCache } from '../../utils/orquestadorVision.ts'
import { claveLimite, exigirLimite } from '../../utils/rateLimit.ts'
import { HttpError, json } from '../../utils/response.ts'
import { exigirSesion } from '../../utils/session.ts'
import { CUPOS_ESCANEO, PROPOSITO_VISION, TTL_TICKET_VISION_S, URL_VISION, pasarelaVisionActiva, type PayloadTicketVision } from '../../utils/ticketVision.ts'

const OPCIONES_LIMITE = { extra: camposLimite(MENSAJE_LIMITE) }

export const onRequestPost: Handler = async ({ request, env, data }) => {
  const sesion = exigirSesion(data.sesion)
  const body = await leerJson(request)
  const sha = body && typeof body === 'object' && 'sha256' in body ? (body as { sha256?: unknown }).sha256 : null
  if (typeof sha !== 'string' || !/^[a-f0-9]{64}$/.test(sha)) throw new HttpError(400, 'La imagen no es válida.')

  const cacheado = await leerPlatoCache(env, `ia:${sha}`)
  if (cacheado) return json({ ok: true, modo: 'cache', plato: cacheado })

  const host = new URL(request.url).hostname
  if (!pasarelaVisionActiva(env.VISION_GATEWAY_URL, host)) {
    return json({ ok: true, modo: 'local' })
  }
  if (!env.AUTH_SECRET || !/^[A-Za-z0-9_-]{1,80}$/.test(sesion.usuarioId)) {
    console.error('[vision-ticket] sin firma')
    throw new HttpError(500, 'Error interno. Inténtalo de nuevo más tarde.')
  }

  await exigirLimite(env, `escanear:min:u:${sesion.usuarioId}`, CUPOS_ESCANEO.porMinuto, 60, MENSAJE_LIMITE, OPCIONES_LIMITE)
  await exigirLimite(env, await claveLimite('escanear:min:ip', data.ip), CUPOS_ESCANEO.porMinuto, 60, MENSAJE_LIMITE, OPCIONES_LIMITE)
  await exigirLimite(env, `analizar:u:${sesion.usuarioId}`, CUPOS_ESCANEO.porDia, 86400, MENSAJE_LIMITE, OPCIONES_LIMITE)
  await exigirLimite(env, `comida:hora:u:${sesion.usuarioId}`, CUPOS_ESCANEO.porHora, 3600, MENSAJE_LIMITE, OPCIONES_LIMITE)

  const exp = Math.floor(Date.now() / 1000) + TTL_TICKET_VISION_S
  const ticket = await firmar(env.AUTH_SECRET, PROPOSITO_VISION, { sub: sesion.usuarioId, exp, img: sha } satisfies PayloadTicketVision)
  return json({ ok: true, modo: 'gateway', ticket, exp, url: URL_VISION })
}
