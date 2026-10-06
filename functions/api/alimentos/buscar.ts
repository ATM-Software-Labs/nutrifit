/**
 * GET /api/alimentos/buscar?q=pechuga de pollo
 * Base de alimentos genéricos (USDA + Ciqual, ~9.700 alimentos con nombre en
 * español, FTS5 sin acentos + corrección de erratas) y productos propios.
 * Open Food Facts se consulta aparte (/api/alimentos/off) para no bloquear.
 * Límite: 60 búsquedas/min por usuario.
 */
import type { Handler } from '../../utils/env.ts'
import { json } from '../../utils/response.ts'
import { queryObj, validar } from '../../utils/http.ts'
import { buscarQuery } from '../../utils/schemas.ts'
import { exigirSesion } from '../../utils/session.ts'
import { exigirLimite } from '../../utils/rateLimit.ts'
import { buscarGenericos } from '../../utils/alimentosDb.ts'
import { buscarPropios } from '../../utils/productos.ts'

export const onRequestGet: Handler = async ({ request, env, data }) => {
  const sesion = exigirSesion(data.sesion)
  const { q } = validar(buscarQuery, queryObj(request.url))
  await exigirLimite(env, `buscar:u:${sesion.usuarioId}`, 60, 60, 'Demasiadas búsquedas seguidas. Espera un momento.')
  const [genericos, propios] = await Promise.all([
    buscarGenericos(env, q).catch((e: unknown) => {
      console.warn('[buscar] BD de alimentos no disponible:', e instanceof Error ? e.message : e)
      return { resultados: [], corregido: null }
    }),
    buscarPropios(env, sesion.usuarioId, q),
  ])
  return json({ ok: true, alimentos: genericos.resultados, propios, corregido: genericos.corregido })
}
