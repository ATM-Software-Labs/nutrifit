/**
 * POST /api/alimentos/escanear — foto → plato unificado, sin nombrar la pasarela.
 * Middleware: sesión, Turnstile (siteverify) y tope horario. La caché D1
 * (catalogo_alimentos_cache, clave ia:<sha256>) no gasta la cuota de la IA.
 */
import type { Handler } from '../../utils/env.ts'
import { error, json } from '../../utils/response.ts'
import { exigirSesion } from '../../utils/session.ts'
import { exigirLimite } from '../../utils/rateLimit.ts'
import { leerImagen } from '../../utils/imagenSubida.ts'
import { ErrorIA } from '../../utils/ia.ts'
import { FotoIlegible } from '../../utils/iaParseo.ts'
import { guardarPlatoCache, huellaImagen, leerPlatoCache, orquestarEscaneo } from '../../utils/orquestadorVision.ts'

export const onRequestPost: Handler = async ({ request, env, data, waitUntil }) => {
  const sesion = exigirSesion(data.sesion)
  const img = await leerImagen(request)
  const clave = await huellaImagen(img.bytes)
  const cacheado = await leerPlatoCache(env, clave)
  if (cacheado) return json(cacheado)

  await exigirLimite(env, `analizar:u:${sesion.usuarioId}`, 10, 86400, 'Has alcanzado el límite de 10 análisis diarios. Puedes añadir la comida manualmente.')
  await exigirLimite(env, `comida:hora:u:${sesion.usuarioId}`, 20, 3600, 'Has pedido demasiados análisis esta hora. Prueba más tarde o añade la comida a mano.')

  try {
    const plato = await orquestarEscaneo(env, img)
    waitUntil(guardarPlatoCache(env, clave, plato).catch(() => undefined))
    return json(plato)
  } catch (e) {
    if (e instanceof FotoIlegible || (e instanceof ErrorIA && e.definitivo)) {
      return error(422, 'No se distingue el alimento con claridad. Intenta enfocar más cerca o con mejor luz.', { codigo: 'foto_no_distinguida' })
    }
    return error(503, 'No hemos podido analizar la foto ahora mismo. Inténtalo de nuevo o añade la comida manualmente.', { codigo: 'ia_no_disponible' })
  }
}
