/**
 * GET /api/friends/suggestions
 *
 * La sesión real es `data.sesion.usuarioId` (cookie __Host-nf_session o Bearer).
 * No existe `context.data.user.id`.
 *
 * Tablas reales (migración 0007), no `users` ni `friendships`:
 *   usuarios.id, usuarios.nombre, usuarios.username, usuarios.avatar_url,
 *   usuarios.bio, usuarios.creado_en
 *   amistades.solicitante_id, amistades.receptor_id, amistades.estado
 *
 * El NOT IN cubre las dos columnas: una amistad solo se guarda en un sentido.
 */
import type { Handler } from '../../utils/env.ts'
import { json } from '../../utils/response.ts'
import { exigirIdentidad } from '../../utils/identidad.ts'
import { exigirLimite } from '../../utils/rateLimit.ts'
import { presentarTexto } from '../../utils/sanitizar.ts'
import { avatarPublico } from '../../utils/comunidad.ts'

interface Fila {
  id: string
  username: string
  nombre: string | null
  avatar_url: string | null
  bio: string | null
}

export const onRequestGet: Handler = async ({ env, data }) => {
  const sesion = await exigirIdentidad(env, data.sesion)
  await exigirLimite(env, `sugerencias:u:${sesion.usuarioId}`, 60, 3600, 'Demasiadas búsquedas de perfil. Espera un rato.')
  const { results } = await env.DB.prepare(
    `SELECT u.id, u.username, u.nombre, u.avatar_url, u.bio
     FROM usuarios u
     WHERE u.id != ?1
       AND u.es_publico = 1
       AND u.username IS NOT NULL
       AND length(u.username) >= 3
       AND u.id NOT IN (
         SELECT f.receptor_id FROM amistades f WHERE f.solicitante_id = ?1
         UNION
         SELECT f.solicitante_id FROM amistades f WHERE f.receptor_id = ?1
       )
     ORDER BY u.creado_en DESC
     LIMIT 10`,
  )
    .bind(sesion.usuarioId)
    .all<Fila>()
  const suggestions = (results ?? []).map((fila) => ({
    id: fila.id,
    username: fila.username,
    name: presentarTexto(fila.nombre),
    avatar_url: avatarPublico(fila.avatar_url),
    bio: presentarTexto(fila.bio),
  }))
  return json({ success: true, suggestions })
}
