/**
 * GET  /api/usuarios/social — perfil social del usuario de la sesión.
 * POST /api/usuarios/social — username, bio, visibilidad y meta de agua.
 * No acepta usuario_id, avatar_url ni banner_url: las fotos van por su endpoint.
 */
import type { Handler } from '../../utils/env.ts'
import { error, json } from '../../utils/response.ts'
import { leerBody } from '../../utils/http.ts'
import { socialSchema } from '../../utils/schemas.ts'
import { exigirIdentidad } from '../../utils/identidad.ts'
import { exigirLimite } from '../../utils/rateLimit.ts'
import { presentarTexto } from '../../utils/sanitizar.ts'

interface FilaSocial {
  username: string | null
  bio: string | null
  avatar_url: string | null
  banner_url: string | null
  es_publico: number
  meta_agua_base_ml: number
  nombre: string | null
}

function presentar(f: FilaSocial) {
  return {
    username: f.username,
    nombre: presentarTexto(f.nombre),
    bio: presentarTexto(f.bio),
    avatar_url: f.avatar_url,
    banner_url: f.banner_url,
    es_publico: f.es_publico,
    meta_agua_base_ml: f.meta_agua_base_ml,
  }
}

async function leer(env: { DB: import('../../utils/env.ts').Env['DB'] }, usuarioId: string) {
  return env.DB.prepare(
    `SELECT username, bio, avatar_url, banner_url, es_publico, meta_agua_base_ml, nombre
     FROM usuarios WHERE id = ?1`,
  )
    .bind(usuarioId)
    .first<FilaSocial>()
}

export const onRequestGet: Handler = async ({ env, data }) => {
  const sesion = await exigirIdentidad(env, data.sesion)
  const fila = await leer(env, sesion.usuarioId)
  if (!fila) return error(404, 'Usuario no encontrado.')
  return json({ ok: true, perfil: presentar(fila) })
}

export const onRequestPost: Handler = async ({ request, env, data }) => {
  const sesion = await exigirIdentidad(env, data.sesion)
  const p = await leerBody(request, socialSchema)
  await exigirLimite(env, `social:u:${sesion.usuarioId}`, 30, 3600, 'Demasiados cambios de perfil. Espera un rato.')
  const actual = await leer(env, sesion.usuarioId)
  if (!actual) return error(404, 'Usuario no encontrado.')

  const username = p.username === undefined ? actual.username : p.username
  const bio = p.bio === undefined ? actual.bio : p.bio || null
  const esPublico = p.es_publico === undefined ? actual.es_publico : p.es_publico
  const metaAgua = p.meta_agua_base_ml === undefined ? actual.meta_agua_base_ml : p.meta_agua_base_ml

  try {
    const fila = await env.DB.prepare(
      `UPDATE usuarios
         SET username = ?1, bio = ?2, es_publico = ?3, meta_agua_base_ml = ?4, actualizado_en = CURRENT_TIMESTAMP
       WHERE id = ?5
       RETURNING username, bio, avatar_url, banner_url, es_publico, meta_agua_base_ml, nombre`,
    )
      .bind(username, bio, esPublico, metaAgua, sesion.usuarioId)
      .first<FilaSocial>()
    return json({ ok: true, perfil: fila ? presentar(fila) : null })
  } catch (e) {
    if (e instanceof Error && /UNIQUE/i.test(e.message)) return error(409, 'Ese nombre de usuario ya está en uso.')
    throw e
  }
}
