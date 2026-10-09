/** DELETE /api/entrenamientos/:id — solo la sesión dueña de la fila. */
import type { Handler } from '../../utils/env.ts'
import { error, json } from '../../utils/response.ts'
import { idRuta } from '../../utils/http.ts'
import { exigirIdentidad } from '../../utils/identidad.ts'

export const onRequestDelete: Handler<'id'> = async ({ env, data, params }) => {
  const sesion = await exigirIdentidad(env, data.sesion)
  const id = idRuta(params.id)
  try {
    const r = await env.DB.prepare('DELETE FROM entrenamientos WHERE id = ?1 AND usuario_id = ?2').bind(id, sesion.usuarioId).run()
    if (!r.meta.changes) return error(404, 'Entrenamiento no encontrado.')
  } catch {
    return error(404, 'Entrenamiento no encontrado.')
  }
  return json({ ok: true, id })
}
