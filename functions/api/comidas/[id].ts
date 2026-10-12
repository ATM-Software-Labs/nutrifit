/**
 * DELETE /api/comidas/:id — solo borra filas del usuario de la sesión.
 * "No existe" y "no es tuya" devuelven el mismo 404 (no se filtra información).
 */
import type { Handler } from '../../utils/env.ts'
import { error, json } from '../../utils/response.ts'
import { validar } from '../../utils/http.ts'
import { uuid } from '../../utils/schemas.ts'
import { exigirSesion } from '../../utils/session.ts'
import { esEmojiValido } from '../../../src/lib/miniaturaComida.ts'

export const onRequestDelete: Handler<'id'> = async ({ env, data, params }) => {
  const sesion = exigirSesion(data.sesion)
  const id = validar(uuid, Array.isArray(params.id) ? params.id[0] : params.id)
  const r = await env.DB.prepare('DELETE FROM diario_comidas WHERE id = ?1 AND usuario_id = ?2').bind(id, sesion.usuarioId).run()
  if (!r.meta.changes) return error(404, 'Comida no encontrada.')
  return json({ ok: true, id })
}

/** PATCH /api/comidas/:id — cambia el emoji de la comida. */
export const onRequestPatch: Handler<'id'> = async ({ request, env, data, params }) => {
  const sesion = exigirSesion(data.sesion)
  const id = validar(uuid, Array.isArray(params.id) ? params.id[0] : params.id)
  const body = (await request.json().catch(() => null)) as { emoji?: unknown } | null
  if (!esEmojiValido(body?.emoji)) return error(400, 'Elige un emoji válido.')
  const r = await env.DB.prepare('UPDATE diario_comidas SET emoji = ?3 WHERE id = ?1 AND usuario_id = ?2').bind(id, sesion.usuarioId, body.emoji).run()
  if (!r.meta.changes) return error(404, 'Comida no encontrada.')
  return json({ ok: true, id, emoji: body.emoji })
}
