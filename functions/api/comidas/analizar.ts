/**
 * POST /api/comidas/analizar — foto de comida → nombre, ingredientes y macros.
 * Middleware: sesión previa + Turnstile + 20/min por IP. Aquí: 10 análisis/día
 * por usuario, imagen ≤ 1.5 MB, tipo real jpeg/png/webp (bytes mágicos).
 * Acepta multipart (campo "imagen") o JSON { imagen: base64|dataURL, mime? }.
 */
import type { Handler } from '../../utils/env.ts'
import { error, json } from '../../utils/response.ts'
import { exigirSesion } from '../../utils/session.ts'
import { exigirLimite } from '../../utils/rateLimit.ts'
import { analizarImagen, ErrorIA } from '../../utils/ia.ts'
import { leerImagen } from '../../utils/imagenSubida.ts'

export const onRequestPost: Handler = async ({ request, env, data }) => {
  const sesion = exigirSesion(data.sesion)
  const img = await leerImagen(request)

  // Se cuenta ANTES de llamar a la IA (protege la cuota aunque el análisis falle).
  await exigirLimite(env, `analizar:u:${sesion.usuarioId}`, 10, 86400, 'Has alcanzado el límite de 10 análisis diarios. Puedes añadir la comida manualmente.')

  try {
    const { proveedor, modelo, resultado } = await analizarImagen(env, img)
    return json({ ok: true, proveedor, modelo, resultado })
  } catch (e) {
    if (e instanceof ErrorIA) {
      return error(503, 'No hemos podido analizar la foto ahora mismo. Inténtalo de nuevo o añade la comida manualmente.', { codigo: 'ia_no_disponible' })
    }
    throw e
  }
}
