/**
 * GET /api/alimentos/off?q=yogur griego  |  ?codigo=8480000610553
 * Búsqueda en Open Food Facts a través del servidor (caché + User-Agent propio;
 * al tercero solo le llega el término o el código, nunca datos del usuario).
 * Límites por usuario: 12 búsquedas / min y 30 códigos / min.
 */
import type { Handler } from '../../utils/env.ts'
import { error, HttpError, json } from '../../utils/response.ts'
import { queryObj, validar } from '../../utils/http.ts'
import { offQuery } from '../../utils/schemas.ts'
import { exigirSesion } from '../../utils/session.ts'
import { exigirLimite } from '../../utils/rateLimit.ts'
import { buscarOFF, productoOFF } from '../../utils/off.ts'

export const onRequestGet: Handler = async (ctx) => {
  const { request, env, data } = ctx
  const sesion = exigirSesion(data.sesion)
  const q = validar(offQuery, queryObj(request.url))
  try {
    if ('codigo' in q) {
      await exigirLimite(env, `off:codigo:u:${sesion.usuarioId}`, 30, 60)
      const producto = await productoOFF(q.codigo, ctx)
      return json({ ok: true, productos: producto ? [producto] : [] })
    }
    await exigirLimite(env, `off:q:u:${sesion.usuarioId}`, 12, 60, 'Demasiadas búsquedas seguidas. Espera un momento.')
    return json({ ok: true, productos: await buscarOFF(q.q, ctx) })
  } catch (e) {
    if (!(e instanceof HttpError)) {
      console.warn('[off] fallo:', e instanceof Error ? e.message : e)
      return error(503, 'Open Food Facts no responde ahora mismo. Prueba con la base de alimentos local.', { codigo: 'off_no_disponible' })
    }
    throw e
  }
}
