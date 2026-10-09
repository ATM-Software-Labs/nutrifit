/**
 * GET  /api/amistades — las del usuario, sin emails ni ids ajenos.
 * POST /api/amistades { username } — el solicitante es la sesión.
 */
import type { Handler } from '../../utils/env.ts'
import { error, HttpError, json } from '../../utils/response.ts'
import { leerBody } from '../../utils/http.ts'
import { amistadSolicitudSchema } from '../../utils/schemas.ts'
import { exigirIdentidad } from '../../utils/identidad.ts'
import { exigirLimite } from '../../utils/rateLimit.ts'
import { enlazarAmistad } from '../../utils/solicitudAmistad.ts'

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
  try {
    const enlace = await enlazarAmistad(env, sesion.usuarioId, receptor.id)
    return json({ ok: true, id: enlace.id, estado: enlace.estado }, { status: enlace.status })
  } catch (e) {
    if (e instanceof HttpError) return error(e.status, e.message, e.extra, e.headers)
    throw e
  }
}
