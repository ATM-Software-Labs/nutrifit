/**
 * GET  /api/amistades — las del usuario, sin emails ni ids ajenos.
 * POST /api/amistades { username } — el solicitante es la sesión.
 */
import type { Handler } from '../../utils/env.ts'
import { error, json } from '../../utils/response.ts'
import { leerBody } from '../../utils/http.ts'
import { amistadSolicitudSchema } from '../../utils/schemas.ts'
import { exigirIdentidad } from '../../utils/identidad.ts'
import { exigirLimite } from '../../utils/rateLimit.ts'

interface FilaAmistad {
  id: string
  estado: string
  creado_en: string
  solicitante_id: string
  username: string | null
}

export const onRequestGet: Handler = async ({ env, data }) => {
  const sesion = await exigirIdentidad(env, data.sesion)
  const { results } = await env.DB.prepare(
    `SELECT a.id, a.estado, a.creado_en, a.solicitante_id,
            CASE WHEN a.solicitante_id = ?1 THEN ur.username ELSE us.username END AS username
     FROM amistades a
     JOIN usuarios us ON us.id = a.solicitante_id
     JOIN usuarios ur ON ur.id = a.receptor_id
     WHERE a.solicitante_id = ?1 OR a.receptor_id = ?1
     ORDER BY a.creado_en DESC
     LIMIT 200`,
  )
    .bind(sesion.usuarioId)
    .all<FilaAmistad>()
  const amistades = (results ?? []).map((a) => ({
    id: a.id,
    estado: a.estado,
    creado_en: a.creado_en,
    username: a.username,
    direccion: a.solicitante_id === sesion.usuarioId ? 'enviada' : 'recibida',
  }))
  return json({ ok: true, amistades })
}

export const onRequestPost: Handler = async ({ request, env, data }) => {
  const sesion = await exigirIdentidad(env, data.sesion)
  const { username } = await leerBody(request, amistadSolicitudSchema)
  await exigirLimite(env, `amistad:u:${sesion.usuarioId}`, 30, 3600, 'Demasiadas solicitudes. Espera un rato.')
  const receptor = await env.DB.prepare('SELECT id FROM usuarios WHERE username = ?1 COLLATE NOCASE').bind(username).first<{ id: string }>()
  if (!receptor) return error(404, 'No hay ninguna cuenta con ese usuario.')
  if (receptor.id === sesion.usuarioId) return error(400, 'No puedes enviarte una solicitud a ti mismo.')

  const existente = await env.DB.prepare(
    `SELECT id, solicitante_id, receptor_id, estado FROM amistades
     WHERE (solicitante_id = ?1 AND receptor_id = ?2) OR (solicitante_id = ?2 AND receptor_id = ?1)`,
  )
    .bind(sesion.usuarioId, receptor.id)
    .first<{ id: string; solicitante_id: string; receptor_id: string; estado: string }>()

  if (existente?.estado === 'aceptada') return error(409, 'Ya sois amigos.')
  if (existente && existente.estado === 'pendiente' && existente.receptor_id === sesion.usuarioId) {
    await env.DB.prepare(`UPDATE amistades SET estado = 'aceptada' WHERE id = ?1 AND receptor_id = ?2 AND estado = 'pendiente'`)
      .bind(existente.id, sesion.usuarioId)
      .run()
    return json({ ok: true, id: existente.id, estado: 'aceptada' })
  }
  if (existente?.estado === 'pendiente') return error(409, 'La solicitud ya está enviada.')

  if (existente?.estado === 'rechazada' && existente.solicitante_id === sesion.usuarioId) {
    await env.DB.prepare(`UPDATE amistades SET estado = 'pendiente', creado_en = datetime('now') WHERE id = ?1 AND solicitante_id = ?2`)
      .bind(existente.id, sesion.usuarioId)
      .run()
    return json({ ok: true, id: existente.id, estado: 'pendiente' })
  }
  if (existente?.estado === 'rechazada') {
    await env.DB.prepare('DELETE FROM amistades WHERE id = ?1').bind(existente.id).run()
  }

  const id = crypto.randomUUID()
  try {
    await env.DB.prepare(`INSERT INTO amistades (id, solicitante_id, receptor_id, estado) VALUES (?1, ?2, ?3, 'pendiente')`)
      .bind(id, sesion.usuarioId, receptor.id)
      .run()
  } catch (e) {
    if (e instanceof Error && /UNIQUE/i.test(e.message)) return error(409, 'La solicitud ya está enviada.')
    throw e
  }
  return json({ ok: true, id, estado: 'pendiente' }, { status: 201 })
}
