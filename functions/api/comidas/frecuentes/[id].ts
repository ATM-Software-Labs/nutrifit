/** DELETE /api/comidas/frecuentes/:id — solo las del usuario de la sesión. */
import type { Handler } from '../../../utils/env.ts'
import { error, json } from '../../../utils/response.ts'
import { idRuta } from '../../../utils/http.ts'
import { exigirIdentidad } from '../../../utils/identidad.ts'

export const onRequestDelete: Handler<'id'> = async ({ env, data, params }) => {
  const sesion = await exigirIdentidad(env, data.sesion)
  const id = idRuta(params.id)
  const r = await env.DB.prepare('DELETE FROM comidas_frecuentes WHERE id = ?1 AND usuario_id = ?2').bind(id, sesion.usuarioId).run()
  if (!r.meta.changes) return error(404, 'Comida no encontrada.')
  return json({ ok: true, id })
}
