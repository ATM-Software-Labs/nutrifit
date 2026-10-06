/**
 * GET /api/alimentos/off?q=yogur griego  |  ?codigo=8480000610553
 * Open Food Facts a través del servidor (caché D1 + User-Agent propio; al
 * tercero solo le llega el término o el código, nunca datos del usuario).
 * Por código se miran ANTES los productos propios del usuario.
 * Límites por usuario: 12 búsquedas / min y 30 códigos / min (+ globales en utils/off.ts).
 */
import type { Handler } from '../../utils/env.ts'
import { error, HttpError, json } from '../../utils/response.ts'
import { queryObj, validar } from '../../utils/http.ts'
import { offQuery } from '../../utils/schemas.ts'
import { exigirSesion } from '../../utils/session.ts'
import { exigirLimite } from '../../utils/rateLimit.ts'
import { buscarOFF, productoOFF } from '../../utils/off.ts'
import { productoPropioPorCodigo } from '../../utils/productos.ts'

export const onRequestGet: Handler = async (ctx) => {
  const { request, env, data } = ctx
  const sesion = exigirSesion(data.sesion)
  const q = validar(offQuery, queryObj(request.url))
  try {
    if ('codigo' in q) {
      await exigirLimite(env, `off:codigo:u:${sesion.usuarioId}`, 30, 60)
      const propio = await productoPropioPorCodigo(env, sesion.usuarioId, q.codigo)
      if (propio) return json({ ok: true, productos: [propio] })
      const producto = await productoOFF(q.codigo, { env, waitUntil: ctx.waitUntil.bind(ctx) })
      return json({ ok: true, productos: producto ? [producto] : [] })
    }
    await exigirLimite(env, `off:q:u:${sesion.usuarioId}`, 12, 60, 'Demasiadas búsquedas seguidas. Espera un momento.')
    return json({ ok: true, productos: await buscarOFF(q.q, { env, waitUntil: ctx.waitUntil.bind(ctx) }) })
  } catch (e) {
    if (!(e instanceof HttpError)) {
      console.warn('[off] fallo:', e instanceof Error ? e.message : e)
      return error(503, 'Open Food Facts no responde ahora mismo. Prueba con la base de alimentos o la foto de la etiqueta.', { codigo: 'off_no_disponible' })
    }
    throw e
  }
}
