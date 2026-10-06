/** Lectura y validación de la imagen subida (multipart "imagen" o JSON base64). */
import { HttpError } from './response.ts'
import { leerBody } from './http.ts'
import { analizarJsonSchema } from './schemas.ts'
import { detectarMime, MAX_IMAGEN_BYTES, type Imagen } from './ia.ts'

export const MAX_JSON_IMAGEN = 2_300_000
const MAX_MULTIPART = MAX_IMAGEN_BYTES + 64 * 1024

function decodificarBase64(s: string): Uint8Array {
  const limpio = s.replace(/^data:image\/[a-z+]+;base64,/i, '').replace(/\s+/g, '')
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(limpio)) throw new HttpError(400, 'La imagen no es base64 válido.')
  const bin = atob(limpio)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function leerBytes(request: Request): Promise<Uint8Array> {
  const ct = (request.headers.get('content-type') ?? '').toLowerCase()
  if (ct.startsWith('multipart/form-data')) {
    if (Number(request.headers.get('content-length') ?? 0) > MAX_MULTIPART) throw new HttpError(413, 'La imagen supera 1,5 MB.')
    const form = await request.formData()
    const f = form.get('imagen') as unknown
    if (!f || typeof f === 'string' || typeof (f as Blob).arrayBuffer !== 'function') throw new HttpError(400, 'Falta el archivo "imagen".')
    return new Uint8Array(await (f as Blob).arrayBuffer())
  }
  const body = await leerBody(request, analizarJsonSchema, MAX_JSON_IMAGEN)
  return decodificarBase64(body.imagen)
}

/** Imagen validada: ≤ 1,5 MB y tipo REAL jpeg/png/webp (bytes mágicos). */
export async function leerImagen(request: Request): Promise<Imagen> {
  const bytes = await leerBytes(request)
  if (bytes.byteLength === 0) throw new HttpError(400, 'La imagen está vacía.')
  if (bytes.byteLength > MAX_IMAGEN_BYTES) throw new HttpError(413, 'La imagen supera 1,5 MB. Redúcela e inténtalo de nuevo.')
  const mime = detectarMime(bytes)
  if (!mime) throw new HttpError(415, 'Formato no soportado. Usa JPEG, PNG o WebP.')
  return { bytes, mime }
}
