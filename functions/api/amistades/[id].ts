/**
 * POST   /api/amistades/:id { estado: 'aceptada' | 'rechazada' } — solo el receptor, y solo si está pendiente.
 * DELETE /api/amistades/:id — cualquiera de los dos la cancela o la borra.
 */
import type { Handler } from '../../utils/env.ts'
import { error, json } from '../../utils/response.ts'
import { idRuta, leerBody } from '../../utils/http.ts'
import { amistadEstadoSchema } from '../../utils/schemas.ts'
import { exigirIdentidad } from '../../utils/identidad.ts'

export const onRequestPost: Handler<'id'> = async ({ request, env, data, params }) => {
  const sesion = await exigirIdentidad(env, data.sesion)
  const id = idRuta(params.id)
  const { estado } = await leerBody(request, amistadEstadoSchema)
  const r = await env.DB.prepare(
    `UPDATE amistades SET estado = ?1
     WHERE id = ?2 AND receptor_id = ?3 AND estado = 'pendiente'`,
  )
    .bind(estado, id, sesion.usuarioId)
    .run()
  if (!r.meta.changes) return error(404, 'Solicitud no encontrada.')
  return json({ ok: true, id, estado })
}

export const onRequestDelete: Handler<'id'> = async ({ env, data, params }) => {
  const sesion = await exigirIdentidad(env, data.sesion)
  const id = idRuta(params.id)
  const r = await env.DB.prepare('DELETE FROM amistades WHERE id = ?1 AND (solicitante_id = ?2 OR receptor_id = ?2)')
    .bind(id, sesion.usuarioId)
    .run()
  if (!r.meta.changes) return error(404, 'Solicitud no encontrada.')
  return json({ ok: true, id })
}
