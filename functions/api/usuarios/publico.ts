/**
 * GET /api/usuarios/publico?username=
 * Solo datos públicos. Una cuenta privada o inexistente responde igual (404)
 * para no confirmar si el nombre existe. Nunca devuelve el email ni el id.
 */
import type { Handler } from '../../utils/env.ts'
import { error, json } from '../../utils/response.ts'
import { queryObj, validar } from '../../utils/http.ts'
import { usernameQuery } from '../../utils/schemas.ts'
import { exigirIdentidad } from '../../utils/identidad.ts'
import { exigirLimite } from '../../utils/rateLimit.ts'
import { presentarTexto } from '../../utils/sanitizar.ts'

export const onRequestGet: Handler = async ({ request, env, data }) => {
  const sesion = await exigirIdentidad(env, data.sesion)
  await exigirLimite(env, `publico:u:${sesion.usuarioId}`, 60, 3600, 'Demasiadas búsquedas de perfil. Espera un rato.')
  const { username } = validar(usernameQuery, queryObj(request.url))
  const fila = await env.DB.prepare(
    `SELECT username, nombre, bio, avatar_url, banner_url
     FROM usuarios
     WHERE username = ?1 COLLATE NOCASE AND es_publico = 1`,
  )
    .bind(username)
    .first<{ username: string; nombre: string | null; bio: string | null; avatar_url: string | null; banner_url: string | null }>()
  if (!fila) return error(404, 'Perfil no encontrado.')
  return json({
    ok: true,
    perfil: {
      username: fila.username,
      nombre: presentarTexto(fila.nombre),
      bio: presentarTexto(fila.bio),
      avatar_url: fila.avatar_url,
      banner_url: fila.banner_url,
    },
  })
}
