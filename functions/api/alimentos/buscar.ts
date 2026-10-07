/**
 * GET /api/alimentos/buscar?q=pechuga de pollo de corral
 * En paralelo:
 *   · genéricos USDA + Ciqual (FTS5) y productos propios del usuario;
 *   · catálogo: Open Food Facts España (v2 y, si no hay texto, cgi/search.pl)
 *     y, para carnes, pescados, frutas y verduras, la ficha BEDCA.
 * El catálogo acertado queda 30 días en KV y, de respaldo, en catalogo_alimentos_cache.
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
import { buscarCatalogo } from '../../utils/catalogoAlimentos.ts'

export const onRequestGet: Handler = async (ctx) => {
  const { request, env, data } = ctx
  const sesion = exigirSesion(data.sesion)
  const { q } = validar(buscarQuery, queryObj(request.url))
  await exigirLimite(env, `buscar:u:${sesion.usuarioId}`, 60, 60, 'Demasiadas búsquedas seguidas. Espera un momento.')
  const catalogoCtx = { env, waitUntil: ctx.waitUntil.bind(ctx) }
  const [genericos, propios, catalogo] = await Promise.all([
    buscarGenericos(env, q).catch((e: unknown) => {
      console.warn('[buscar] BD de alimentos no disponible:', e instanceof Error ? e.message : e)
      return { resultados: [], corregido: null }
    }),
    buscarPropios(env, sesion.usuarioId, q),
    buscarCatalogo(q, catalogoCtx).catch((e: unknown) => {
      console.warn('[buscar] catálogo no disponible:', e instanceof Error ? e.message : e)
      return { alimentos: [], cache: false }
    }),
  ])
  return json({
    ok: true,
    alimentos: genericos.resultados,
    propios,
    corregido: genericos.corregido,
    catalogo: catalogo.alimentos,
    catalogo_cache: catalogo.cache,
  })
}
