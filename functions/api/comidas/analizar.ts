/**
 * POST /api/comidas/analizar — foto de comida → nombre, ingredientes y macros.
 * Middleware: sesión previa + Turnstile + 20/min por IP. Aquí: 10 análisis/día
 * por usuario, imagen ≤ 1.5 MB, tipo real jpeg/png/webp (bytes mágicos).
 * Acepta multipart (campo "imagen") o JSON { imagen: base64|dataURL, mime? }.
 */
import type { Handler } from '../../utils/env.ts'
import { error, HttpError, json } from '../../utils/response.ts'
import { leerBody } from '../../utils/http.ts'
import { analizarJsonSchema } from '../../utils/schemas.ts'
import { exigirSesion } from '../../utils/session.ts'
import { exigirLimite } from '../../utils/rateLimit.ts'
import { analizarImagen, detectarMime, ErrorIA, MAX_IMAGEN_BYTES, type Imagen } from '../../utils/ia.ts'

const MAX_JSON = 2_300_000
const MAX_MULTIPART = MAX_IMAGEN_BYTES + 64 * 1024

function decodificarBase64(s: string): Uint8Array {
  const limpio = s.replace(/^data:image\/[a-z+]+;base64,/i, '').replace(/\s+/g, '')
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(limpio)) throw new HttpError(400, 'La imagen no es base64 válido.')
  const bin = atob(limpio)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function leerImagen(request: Request): Promise<Uint8Array> {
  const ct = (request.headers.get('content-type') ?? '').toLowerCase()
  if (ct.startsWith('multipart/form-data')) {
    if (Number(request.headers.get('content-length') ?? 0) > MAX_MULTIPART) throw new HttpError(413, 'La imagen supera 1,5 MB.')
    const form = await request.formData()
    const f = form.get('imagen') as unknown
    if (!f || typeof f === 'string' || typeof (f as Blob).arrayBuffer !== 'function') {
      throw new HttpError(400, 'Falta el archivo "imagen".')
    }
    return new Uint8Array(await (f as Blob).arrayBuffer())
  }
  const body = await leerBody(request, analizarJsonSchema, MAX_JSON)
  return decodificarBase64(body.imagen)
}

export const onRequestPost: Handler = async ({ request, env, data }) => {
  const sesion = exigirSesion(data.sesion)

  const bytes = await leerImagen(request)
  if (bytes.byteLength === 0) throw new HttpError(400, 'La imagen está vacía.')
  if (bytes.byteLength > MAX_IMAGEN_BYTES) throw new HttpError(413, 'La imagen supera 1,5 MB. Redúcela e inténtalo de nuevo.')
  const mime = detectarMime(bytes)
  if (!mime) throw new HttpError(415, 'Formato no soportado. Usa JPEG, PNG o WebP.')

  // Se cuenta ANTES de llamar a la IA (protege la cuota aunque el análisis falle).
  await exigirLimite(env, `analizar:u:${sesion.usuarioId}`, 10, 86400, 'Has alcanzado el límite de 10 análisis diarios. Puedes añadir la comida manualmente.')

  const img: Imagen = { bytes, mime }
  try {
    const { proveedor, resultado } = await analizarImagen(env, img)
    return json({ ok: true, proveedor, resultado })
  } catch (e) {
    if (e instanceof ErrorIA) {
      return error(503, 'No hemos podido analizar la foto ahora mismo. Inténtalo de nuevo o añade la comida manualmente.', { codigo: 'ia_no_disponible' })
    }
    throw e
  }
}
