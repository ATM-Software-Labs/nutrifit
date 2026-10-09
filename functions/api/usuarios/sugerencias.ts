/**
 * GET /api/usuarios/sugerencias
 * Alias: GET /api/users/suggestions
 *
 * Hasta 10 perfiles públicos, los más recientes primero.
 * Fuera: la sesión y las amistades ya aceptadas.
 * El cuerpo es un array JSON. Si no hay nadie, es [].
 * No devuelve id ni email: la tarjeta usa el username.
 */
import type { Handler } from '../../utils/env.ts'
import { json } from '../../utils/response.ts'
import { exigirIdentidad } from '../../utils/identidad.ts'
import { exigirLimite } from '../../utils/rateLimit.ts'
import { presentarTexto } from '../../utils/sanitizar.ts'
import { avatarPublico, SQL_EXCLUIR_AMIGOS } from '../../utils/comunidad.ts'

interface Fila {
  username: string
  nombre: string | null
  avatar_url: string | null
  bio: string | null
}

export const onRequestGet: Handler = async ({ env, data }) => {
  const sesion = await exigirIdentidad(env, data.sesion)
  await exigirLimite(env, `sugerencias:u:${sesion.usuarioId}`, 60, 3600, 'Demasiadas búsquedas de perfil. Espera un rato.')
  const { results } = await env.DB.prepare(
    `SELECT username, nombre, avatar_url, bio
     FROM usuarios
     WHERE id != ?1
       AND es_publico = 1
       AND username IS NOT NULL
       AND length(username) >= 3
       ${SQL_EXCLUIR_AMIGOS}
     ORDER BY creado_en DESC
     LIMIT 10`,
  )
    .bind(sesion.usuarioId)
    .all<Fila>()
  const sugerencias = (results ?? []).map((f) => ({
    username: f.username,
    nombre: presentarTexto(f.nombre),
    avatar_url: avatarPublico(f.avatar_url),
    bio: presentarTexto(f.bio),
  }))
  return json(sugerencias)
}
