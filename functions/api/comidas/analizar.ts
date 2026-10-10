/**
 * POST /api/comidas/analizar — foto de comida → nombre, ingredientes y macros.
 * Middleware: sesión previa + Turnstile + 20/hora por usuario. Aquí: 10 análisis/día
 * por usuario, imagen ≤ 1,5 MB, tipo real jpeg/png/webp (bytes mágicos).
 * Acepta multipart (campo "imagen") o JSON { imagen: base64|dataURL, mime? }.
 *
 * El cliente (src/lib/imagen.ts) normaliza antes la foto: canvas, lado mayor
 * 1024 px (baja hasta 800 px si pasa de 130 KB), WebP 0.75 (JPEG 0.75 si no hay WebP), sin EXIF.
 * La cadena (functions/utils/ia.ts)
 * es un circuit breaker por gateway, 5 s cada uno:
 *   1. Gemini Flash (GEMINI_API_KEY)
 *   2. Groq Vision: llama-3.2-11b-vision-preview y, si falla dentro del plazo,
 *      llama-3.2-90b-vision-preview (GROQ_API_KEY)
 *   3. Trujillo AI (https://ai.trujillomingorance.com/v1/chat/completions)
 *   4. Workers AI @cf/meta/llama-3.2-11b-vision-instruct
 * El modelo de la foto es Gemini Flash (gemini-2.0-flash, o GEMINI_MODEL),
 * temperature 0.1 y max_tokens 2048. Un plato combinado se desglosa en
 * ingredientes con grams, min_grams y max_grams. Si la foto no se distingue,
 * el modelo devuelve is_food:false y no se prueba otro proveedor. El respaldo de Workers AI es
 * @cf/meta/llama-3.2-11b-vision-instruct. El parser lo traduce a
 * ResultadoAnalisis (functions/utils/iaParseo.ts).
 */
import type { Handler } from '../../utils/env.ts'
import { json } from '../../utils/response.ts'
import { exigirSesion } from '../../utils/session.ts'
import { claveLimite, exigirLimite } from '../../utils/rateLimit.ts'
import { camposLimite, conContextoVision, MENSAJE_LIMITE, respuestaFalloVision } from '../../utils/errorVision.ts'
import { analizarImagen, type Imagen } from '../../utils/ia.ts'
import { leerImagen } from '../../utils/imagenSubida.ts'

export const onRequestPost: Handler = async ({ request, env, data }) => {
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
    const opciones = { extra: camposLimite(MENSAJE_LIMITE) }
    await exigirLimite(env, `escanear:min:u:${sesion.usuarioId}`, 8, 60, MENSAJE_LIMITE, opciones)
    await exigirLimite(env, await claveLimite('escanear:min:ip', data.ip), 8, 60, MENSAJE_LIMITE, opciones)
    await exigirLimite(env, `analizar:u:${sesion.usuarioId}`, 10, 86400, MENSAJE_LIMITE, opciones)

    try {
      const { proveedor, modelo, resultado } = await analizarImagen(env, img)
      return json({ ok: true, proveedor, modelo, resultado })
    } catch (e) {
      const res = respuestaFalloVision(e)
      if (res) return res
      throw e
    }
  })
}
