/**
 * GET /api/auth/qr/info?id=…   (móvil CON sesión, tras escanear)
 * Datos para «¿Iniciar sesión en este ordenador?»: código corto, dispositivo,
 * ubicación aproximada y hora. 404 si no existe, caducó o ya se decidió.
 */
import type { Handler } from '../../../utils/env.ts'
import { HttpError, json } from '../../../utils/response.ts'
import { queryObj, validar } from '../../../utils/http.ts'
import { qrIdQuery } from '../../../utils/schemas.ts'
import { exigirSesion } from '../../../utils/session.ts'
import { exigirLimite } from '../../../utils/rateLimit.ts'
import { infoEmparejamiento } from '../../../utils/emparejamiento.ts'

export const onRequestGet: Handler = async ({ request, env, data }) => {
  const sesion = exigirSesion(data.sesion)
  await exigirLimite(env, `qr:info:u:${sesion.usuarioId}`, 30, 600)
  const { id } = validar(qrIdQuery, queryObj(request.url))
  const info = await infoEmparejamiento(env, id)
  if (!info) throw new HttpError(404, 'Este código QR ha caducado o ya se ha usado. Genera uno nuevo en el ordenador.', { codigo: 'qr_caducado' })
  return json({ ok: true, ...info })
}
