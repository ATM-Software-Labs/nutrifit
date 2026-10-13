/**
 * DELETE /api/comidas/:id — solo borra filas del usuario de la sesión.
 * "No existe" y "no es tuya" devuelven el mismo 404 (no se filtra información).
 */
import type { Handler } from '../../utils/env.ts'
import { error, json } from '../../utils/response.ts'
import { validar } from '../../utils/http.ts'
import { comidaEditarSchema, uuid } from '../../utils/schemas.ts'
import { leerBody } from '../../utils/http.ts'
import { aComidaApi, type FilaComida } from '../../utils/comidas.ts'
import { exigirSesion } from '../../utils/session.ts'
import { esEmojiValido } from '../../../src/lib/miniaturaComida.ts'

export const onRequestDelete: Handler<'id'> = async ({ env, data, params }) => {
  const sesion = exigirSesion(data.sesion)
  const id = validar(uuid, Array.isArray(params.id) ? params.id[0] : params.id)
  const r = await env.DB.prepare('DELETE FROM diario_comidas WHERE id = ?1 AND usuario_id = ?2').bind(id, sesion.usuarioId).run()
  if (!r.meta.changes) return error(404, 'Comida no encontrada.')
  return json({ ok: true, id })
}

const CAMPOS = ['descripcion', 'emoji', 'tipo_comida', 'fecha', 'hora', 'cantidad', 'unidad', 'calorias', 'proteinas', 'carbohidratos', 'grasas', 'fibra', 'azucares', 'sal', 'notas'] as const

/** PATCH /api/comidas/:id — edita cualquier propiedad de la comida (validado con Zod). */
export const onRequestPatch: Handler<'id'> = async ({ request, env, data, params }) => {
  const sesion = exigirSesion(data.sesion)
  const id = validar(uuid, Array.isArray(params.id) ? params.id[0] : params.id)
  const c = await leerBody(request, comidaEditarSchema, 16 * 1024)
  if (c.emoji !== undefined && !esEmojiValido(c.emoji)) return error(400, 'Elige un emoji válido.')
  const sets: string[] = []
  const vals: unknown[] = [id, sesion.usuarioId]
  for (const k of CAMPOS) {
    const v = (c as Record<string, unknown>)[k]
    if (v === undefined) continue
    vals.push(v)
    sets.push(`${k} = ?${vals.length}`)
  }
  const fila = await env.DB.prepare(`UPDATE diario_comidas SET ${sets.join(', ')} WHERE id = ?1 AND usuario_id = ?2 RETURNING *`).bind(...vals).first<FilaComida>()
  if (!fila) return error(404, 'Comida no encontrada.')
  return json({ ok: true, comida: aComidaApi(fila) })
}
