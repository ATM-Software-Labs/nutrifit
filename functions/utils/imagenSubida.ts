/** Lectura de una imagen: multipart "imagen" o JSON base64. El tipo real sale de los bytes. */
import { HttpError } from './response.ts'
import { leerBody } from './http.ts'
import { analizarJsonSchema, subirImagenSchema } from './schemas.ts'
import { contieneScriptPoliglota, detectarMime, MAX_IMAGEN_BYTES, type Imagen } from './ia.ts'
import { MAX_SUBIDA_BYTES, validarImagenSubida } from './archivos.ts'

export const MAX_JSON_IMAGEN = 2_300_000
const MAX_JSON_SUBIDA = 2_600_000

function decodificarBase64(s: string): Uint8Array {
  const limpio = s.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, '').replace(/\s+/g, '')
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(limpio)) throw new HttpError(400, 'La imagen no es base64 válido.')
  const bin = atob(limpio)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function mensajeTamano(maxBytes: number): string {
  return maxBytes >= MAX_SUBIDA_BYTES
    ? 'La imagen supera el máximo de 2 MB.'
    : 'La imagen supera 1,5 MB. Redúcela e inténtalo de nuevo.'
}

async function leerBytes(request: Request, maxBytes: number, jsonMax: number, subida: boolean): Promise<{ bytes: Uint8Array; mimeDeclarado: string | null }> {
  const ct = (request.headers.get('content-type') ?? '').toLowerCase()
  const topeHttp = maxBytes + 64 * 1024
  if (Number(request.headers.get('content-length') ?? 0) > (ct.startsWith('application/json') ? jsonMax : topeHttp)) {
    throw new HttpError(413, mensajeTamano(maxBytes))
  }
  if (ct.startsWith('multipart/form-data')) {
    const form = await request.formData()
    const f = form.get('imagen') as unknown
    if (!f || typeof f === 'string' || typeof (f as Blob).arrayBuffer !== 'function') throw new HttpError(400, 'Falta el archivo "imagen".')
    const archivo = f as Blob & { type?: string }
    const bytes = new Uint8Array(await archivo.arrayBuffer())
    return { bytes, mimeDeclarado: archivo.type || null }
  }
  const body = await leerBody(request, subida ? subirImagenSchema : analizarJsonSchema, jsonMax)
  const declarado = 'mime' in body ? body.mime : null
  return { bytes: decodificarBase64(body.imagen), mimeDeclarado: declarado ?? null }
}

async function leer(request: Request, maxBytes: number, jsonMax: number, estricto: boolean): Promise<Imagen> {
  const { bytes, mimeDeclarado } = await leerBytes(request, maxBytes, jsonMax, estricto)
  if (bytes.byteLength > maxBytes) throw new HttpError(413, mensajeTamano(maxBytes))
  if (!estricto && maxBytes < MAX_SUBIDA_BYTES) {
    if (bytes.byteLength === 0) throw new HttpError(400, 'La imagen está vacía.')
    const mime = detectarMime(bytes)
    // La firma manda. Un binario sin JPEG/PNG/WebP, o con un script políglota, no llega al modelo.
    if (!mime || contieneScriptPoliglota(bytes)) throw new HttpError(400, 'Formato no soportado. Usa JPEG, PNG o WebP.')
    return validarImagenSubida(bytes, mimeDeclarado, false)
  }
  return validarImagenSubida(bytes, mimeDeclarado, estricto)
}

/** Análisis de plato: tope histórico de 1,5 MB y bytes mágicos jpeg/png/webp. */
export async function leerImagen(request: Request): Promise<Imagen> {
  return leer(request, MAX_IMAGEN_BYTES, MAX_JSON_IMAGEN, false)
}

/** Avatar, banner y foto guardada: máximo 2 MB (1,9 MB útiles por el tope de fila de D1). */
export async function leerImagenSubida(request: Request): Promise<Imagen> {
  return leer(request, MAX_SUBIDA_BYTES, MAX_JSON_SUBIDA, true)
}
