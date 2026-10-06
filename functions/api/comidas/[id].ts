/**
 * DELETE /api/comidas/:id — solo borra filas del usuario de la sesión.
 * "No existe" y "no es tuya" devuelven el mismo 404 (no se filtra información).
 */
import type { Handler } from '../../utils/env.ts'
import { error, json } from '../../utils/response.ts'
import { validar } from '../../utils/http.ts'
import { uuid } from '../../utils/schemas.ts'
import { exigirSesion } from '../../utils/session.ts'

export const onRequestDelete: Handler<'id'> = async ({ env, data, params }) => {
  const sesion = exigirSesion(data.sesion)
  const id = validar(uuid, Array.isArray(params.id) ? params.id[0] : params.id)
  const r = await env.DB.prepare('DELETE FROM diario_comidas WHERE id = ?1 AND usuario_id = ?2').bind(id, sesion.usuarioId).run()
  if (!r.meta.changes) return error(404, 'Comida no encontrada.')
  return json({ ok: true, id })
}
