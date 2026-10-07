/**
 * POST /api/comidas/analizar — foto de comida → nombre, ingredientes y macros.
 * Middleware: sesión previa + Turnstile + 20/hora por usuario. Aquí: 10 análisis/día
 * por usuario, imagen ≤ 1,5 MB, tipo real jpeg/png/webp (bytes mágicos).
 * Acepta multipart (campo "imagen") o JSON { imagen: base64|dataURL, mime? }.
 *
 * El cliente (src/lib/imagen.ts) normaliza antes la foto: canvas, lado mayor
 * 768 px, WebP 0.70 (JPEG si no hay WebP), ≤ 100 KB, sin EXIF. La cadena (functions/utils/ia.ts)
 * es un circuit breaker por gateway, 5 s cada uno:
 *   1. Gemini Flash (GEMINI_API_KEY)
 *   2. Groq Vision: llama-3.2-11b-vision-preview y, si falla dentro del plazo,
 *      llama-3.2-90b-vision-preview (GROQ_API_KEY)
 *   3. Trujillo AI (https://ai.trujillomingorance.com/v1/chat/completions)
 *   4. Workers AI @cf/meta/llama-3.2-11b-vision-instruct
 * El modelo de la foto es Gemini Flash (gemini-3.8-flash, o GEMINI_MODEL),
 * temperature 0.1 y max_tokens 1200. Un plato combinado se desglosa en
 * ingredientes con grams, min_grams y max_grams. Si la foto no se distingue,
 * el modelo devuelve is_food:false y no se prueba otro proveedor. El respaldo de Workers AI es
 * @cf/meta/llama-3.2-11b-vision-instruct. El parser lo traduce a
 * ResultadoAnalisis (functions/utils/iaParseo.ts).
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
    if (e instanceof ErrorIA && e.definitivo) {
      return error(422, e.message, { codigo: 'foto_no_distinguida' })
    }
    if (e instanceof ErrorIA) {
      return error(503, 'No hemos podido analizar la foto ahora mismo. Inténtalo de nuevo o añade la comida manualmente.', { codigo: 'ia_no_disponible' })
    }
    throw e
  }
}
