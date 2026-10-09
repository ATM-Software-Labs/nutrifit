/**
 * POST /api/alimentos/escanear — foto → plato unificado, sin nombrar la pasarela.
 * Middleware: sesión, Turnstile (siteverify) y tope horario. La caché D1
 * (catalogo_alimentos_cache, clave ia:<sha256>) no gasta la cuota de la IA.
 */
import type { Handler } from '../../utils/env.ts'
import { json } from '../../utils/response.ts'
import { exigirSesion } from '../../utils/session.ts'
import { claveLimite, exigirLimite } from '../../utils/rateLimit.ts'
import { leerImagen } from '../../utils/imagenSubida.ts'
import { camposLimite, conContextoVision, MENSAJE_LIMITE, respuestaFalloVision } from '../../utils/errorVision.ts'
import type { Imagen } from '../../utils/ia.ts'
import { guardarPlatoCache, huellaImagen, leerPlatoCache, orquestarEscaneo } from '../../utils/orquestadorVision.ts'
import { CUPOS_ESCANEO } from '../../utils/ticketVision.ts'

const OPCIONES_LIMITE = { extra: camposLimite(MENSAJE_LIMITE) }

export const onRequestPost: Handler = async ({ request, env, data, waitUntil }) => {
  const sesion = exigirSesion(data.sesion)
  let img: Imagen
  try {
    img = await leerImagen(request)
  } catch (e) {
    const res = respuestaFalloVision(e)
    if (res) return res
    throw e
  }
  return conContextoVision(request, img.bytes.byteLength, async () => {
    const clave = await huellaImagen(img.bytes)
    const cacheado = await leerPlatoCache(env, clave)
    if (cacheado) return json(cacheado)

    await exigirLimite(env, `escanear:min:u:${sesion.usuarioId}`, CUPOS_ESCANEO.porMinuto, 60, MENSAJE_LIMITE, OPCIONES_LIMITE)
    await exigirLimite(env, await claveLimite('escanear:min:ip', data.ip), CUPOS_ESCANEO.porMinuto, 60, MENSAJE_LIMITE, OPCIONES_LIMITE)
    await exigirLimite(env, `analizar:u:${sesion.usuarioId}`, CUPOS_ESCANEO.porDia, 86400, MENSAJE_LIMITE, OPCIONES_LIMITE)
    await exigirLimite(env, `comida:hora:u:${sesion.usuarioId}`, CUPOS_ESCANEO.porHora, 3600, MENSAJE_LIMITE, OPCIONES_LIMITE)

    try {
      const plato = await orquestarEscaneo(env, img)
      waitUntil(guardarPlatoCache(env, clave, plato).catch(() => undefined))
      return json(plato)
    } catch (e) {
      const res = respuestaFalloVision(e)
      if (res) return res
      throw e
    }
  })
}
