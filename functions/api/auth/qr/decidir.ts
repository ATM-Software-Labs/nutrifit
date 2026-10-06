/**
 * POST /api/auth/qr/decidir  { id, aprobar }   (móvil CON sesión)
 * Aprueba o rechaza el inicio de sesión en el PC. Solo una vez, dentro de los
 * 2 minutos. Límite: 20 / 10 min por usuario.
 */
import type { Handler } from '../../../utils/env.ts'
import { HttpError, json } from '../../../utils/response.ts'
import { leerBody } from '../../../utils/http.ts'
import { qrDecidirSchema } from '../../../utils/schemas.ts'
import { exigirSesion } from '../../../utils/session.ts'
import { exigirLimite } from '../../../utils/rateLimit.ts'
import { decidirEmparejamiento } from '../../../utils/emparejamiento.ts'

export const onRequestPost: Handler = async ({ request, env, data }) => {
  const sesion = exigirSesion(data.sesion)
  await exigirLimite(env, `qr:decidir:u:${sesion.usuarioId}`, 20, 600)
  const { id, aprobar } = await leerBody(request, qrDecidirSchema)
  const ok = await decidirEmparejamiento(env, id, sesion.usuarioId, aprobar)
  if (!ok) throw new HttpError(410, 'Este código QR ha caducado o ya se ha usado. Genera uno nuevo en el ordenador.', { codigo: 'qr_caducado' })
  return json({ ok: true, aprobado: aprobar })
}
