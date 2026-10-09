/**
 * GET /api/usuarios/publico?username=  → un perfil público.
 * GET /api/usuarios/publico?pagina=    → comunidad, 5 en 5, sin término.
 * Una cuenta privada o inexistente responde igual (404) para no confirmar
 * si el nombre existe. Nunca devuelve el email ni el id.
 */
import type { Handler } from '../../utils/env.ts'
import { error, json } from '../../utils/response.ts'
import { queryObj, validar } from '../../utils/http.ts'
import { comunidadQuery, usernameQuery } from '../../utils/schemas.ts'
import { exigirIdentidad } from '../../utils/identidad.ts'
import { exigirLimite } from '../../utils/rateLimit.ts'
import { presentarTexto } from '../../utils/sanitizar.ts'
import { avatarPublico, SQL_EXCLUIR_AMIGOS } from '../../utils/comunidad.ts'

const POR_PAGINA = 5

export const onRequestGet: Handler = async ({ request, env, data }) => {
  const sesion = await exigirIdentidad(env, data.sesion)
  await exigirLimite(env, `publico:u:${sesion.usuarioId}`, 60, 3600, 'Demasiadas búsquedas de perfil. Espera un rato.')
  const bruto = queryObj(request.url)
  const usernameBruto = typeof bruto.username === 'string' ? bruto.username.trim() : ''

  if (usernameBruto) {
    const { username } = validar(usernameQuery, { username: usernameBruto })
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
        avatar_url: avatarPublico(fila.avatar_url),
        banner_url: avatarPublico(fila.banner_url),
      },
    })
  }

  const cruda = typeof bruto.pagina === 'string' && bruto.pagina.trim() ? bruto.pagina : undefined
  const { pagina } = validar(comunidadQuery, cruda ? { pagina: cruda } : {})
  const n = pagina ?? 1
  const { results } = await env.DB.prepare(
    `SELECT username, nombre, avatar_url
     FROM usuarios
     WHERE es_publico = 1
       AND username IS NOT NULL
       AND length(username) >= 3
       AND id != ?1
       ${SQL_EXCLUIR_AMIGOS}
     ORDER BY actualizado_en IS NULL, actualizado_en DESC, username COLLATE NOCASE
     LIMIT ?2 OFFSET ?3`,
  )
    .bind(sesion.usuarioId, POR_PAGINA + 1, (n - 1) * POR_PAGINA)
    .all<{ username: string; nombre: string | null; avatar_url: string | null }>()
  const filas = results ?? []
  const hayMas = filas.length > POR_PAGINA
  return json({
    ok: true,
    comunidad: filas.slice(0, POR_PAGINA).map((f) => ({
      username: f.username,
      nombre: presentarTexto(f.nombre),
      avatar_url: avatarPublico(f.avatar_url),
    })),
    pagina: n,
    hay_mas: hayMas,
  })
}
