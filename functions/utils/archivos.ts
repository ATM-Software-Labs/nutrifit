/**
 * Avatar, banner y foto de plato. El id lo genera el servidor
 * (`crypto.randomUUID`); el nombre del fichero del cliente no se guarda.
 * D1 admite una fila de 2_000_000 bytes, así que el blob se queda en 1_900_000.
 */
import type { Env } from './env.ts'
import { HttpError } from './response.ts'
import { contieneScriptPoliglota, detectarMime, type Imagen } from './ia.ts'

export const MAX_SUBIDA_BYTES = 1_900_000
export const MIME_IMAGEN = ['image/jpeg', 'image/png', 'image/webp'] as const
export type MimeImagen = (typeof MIME_IMAGEN)[number]
export type ClaseArchivo = 'avatar' | 'banner' | 'plato'

const MIME_OK = new Set<string>(MIME_IMAGEN)

export function normalizarMime(valor: string | null | undefined): string | null {
  if (!valor) return null
  const t = valor.toLowerCase().split(';')[0]!.trim()
  if (!t) return null
  if (t === 'image/jpg' || t === 'image/pjpeg') return 'image/jpeg'
  if (t === 'image/x-png') return 'image/png'
  return t
}

/** Bytes reales + tipo declarado. El declarado, si viene, tiene que coincidir. */
export function validarImagenSubida(bytes: Uint8Array, mimeDeclarado?: string | null, estricto = true): Imagen {
  if (bytes.byteLength === 0) throw new HttpError(400, 'La imagen está vacía.')
  if (bytes.byteLength > MAX_SUBIDA_BYTES) throw new HttpError(413, 'La imagen supera el máximo de 2 MB.')
  const mime = detectarMime(bytes)
  if (!mime || !MIME_OK.has(mime) || contieneScriptPoliglota(bytes)) throw new HttpError(415, 'Formato no soportado. Usa JPEG, PNG o WebP.')
  const declarado = normalizarMime(mimeDeclarado)
  if (estricto && declarado && !MIME_OK.has(declarado)) {
    throw new HttpError(415, 'Formato no soportado. Usa JPEG, PNG o WebP.')
  }
  if (declarado && MIME_OK.has(declarado) && declarado !== mime) {
    throw new HttpError(415, 'El tipo del archivo no coincide con su contenido.')
  }
  if (!estricto && declarado?.startsWith('image/') && !MIME_OK.has(declarado)) {
    throw new HttpError(415, 'Formato no soportado. Usa JPEG, PNG o WebP.')
  }
  return { bytes, mime }
}

export function idDeArchivoUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const m = /^\/api\/archivos\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(url)
  return m ? m[1]! : null
}

export async function guardarArchivo(env: Env, usuarioId: string, clase: ClaseArchivo, imagen: Imagen): Promise<{ id: string; url: string }> {
  const id = crypto.randomUUID()
  await env.DB.prepare(
    `INSERT INTO archivos_usuario (id, usuario_id, clase, mime, bytes, contenido) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
  )
    .bind(id, usuarioId, clase, imagen.mime, imagen.bytes.byteLength, imagen.bytes)
    .run()
  return { id, url: `/api/archivos/${id}` }
}

export async function borrarArchivo(env: Env, usuarioId: string, url: string | null | undefined): Promise<void> {
  const id = idDeArchivoUrl(url)
  if (!id) return
  await env.DB.prepare('DELETE FROM archivos_usuario WHERE id = ?1 AND usuario_id = ?2').bind(id, usuarioId).run()
}

/** Sustituye avatar o banner del usuario y borra el fichero anterior. */
export async function asignarImagenPerfil(env: Env, usuarioId: string, clase: 'avatar' | 'banner', imagen: Imagen): Promise<string> {
  const columna = clase === 'avatar' ? 'avatar_url' : 'banner_url'
  const previo = await env.DB.prepare(`SELECT ${columna} AS url FROM usuarios WHERE id = ?1`).bind(usuarioId).first<{ url: string | null }>()
  const { url } = await guardarArchivo(env, usuarioId, clase, imagen)
  await env.DB.prepare(`UPDATE usuarios SET ${columna} = ?1, actualizado_en = CURRENT_TIMESTAMP WHERE id = ?2`).bind(url, usuarioId).run()
  if (previo?.url && previo.url !== url) await borrarArchivo(env, usuarioId, previo.url)
  return url
}

export function aBytes(valor: unknown): Uint8Array | null {
  if (valor instanceof Uint8Array) return valor
  if (valor instanceof ArrayBuffer) return new Uint8Array(valor)
  if (ArrayBuffer.isView(valor)) return new Uint8Array(valor.buffer, valor.byteOffset, valor.byteLength)
  return null
}
