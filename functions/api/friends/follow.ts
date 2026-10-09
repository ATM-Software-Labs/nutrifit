/**
 * POST /api/friends/follow
 * Cuerpo: { targetUserId }. Inserta en `amistades` con el id de la sesión
 * como solicitante_id. `estado` queda `pendiente` hasta que la otra parte acepta.
 * Si esa parte ya te había escrito, la fila pasa a `aceptada`.
 */
import type { Handler } from '../../utils/env.ts'
import { error, json, HttpError } from '../../utils/response.ts'
import { leerBody } from '../../utils/http.ts'
import { seguirSchema } from '../../utils/schemas.ts'
import { exigirIdentidad } from '../../utils/identidad.ts'
import { exigirLimite } from '../../utils/rateLimit.ts'
import { enlazarAmistad } from '../../utils/solicitudAmistad.ts'

export const onRequestPost: Handler = async ({ request, env, data }) => {
  const sesion = await exigirIdentidad(env, data.sesion)
  const { targetUserId } = await leerBody(request, seguirSchema)
  await exigirLimite(env, `amistad:u:${sesion.usuarioId}`, 30, 3600, 'Demasiadas solicitudes. Espera un rato.')
  const destino = await env.DB.prepare(
    `SELECT id FROM usuarios
     WHERE id = ?1 AND es_publico = 1 AND username IS NOT NULL AND length(username) >= 3`,
  )
    .bind(targetUserId)
    .first<{ id: string }>()
  if (!destino) return error(404, 'Perfil no encontrado.')
  try {
    const enlace = await enlazarAmistad(env, sesion.usuarioId, destino.id)
    return json(
      { success: true, id: enlace.id, status: enlace.estado === 'aceptada' ? 'accepted' : 'pending' },
      { status: enlace.status },
    )
  } catch (e) {
    if (e instanceof HttpError) return error(e.status, e.message, e.extra, e.headers)
    throw e
  }
}
