/**
 * Preprocesado de la foto del plato, en el dispositivo, antes de
 * POST /api/comidas/analizar:
 *   · canvas HTML (OffscreenCanvas si existe);
 *   · el lado mayor no pasa de 768 px, sin recortar ni ampliar;
 *   · WebP calidad 0.70, o JPEG si el navegador no codifica WebP;
 *   · se baja calidad y tamaño hasta quedar en 100 KB;
 *   · se vuelve a codificar: el EXIF (GPS incluido) no se copia.
 * La orientación EXIF se aplica al decodificar para que el plato no quede girado.
 * El Blob original no se sube.
 */
import { CALIDAD_FOTO, encajeLadoMayor, LADO_MAYOR, MAX_FOTO_BYTES } from './encajeImagen.ts'

export class ErrorImagen extends Error {}

async function decodificar(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      // from-image hornea la orientación y deja fuera el resto del EXIF.
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      /* p. ej. HEIC en navegadores que no lo soportan → probamos con <img> */
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await img.decode()
    return img
  } catch {
    throw new ErrorImagen('No hemos podido leer esta imagen. Prueba con una foto JPEG o PNG.')
  } finally {
    URL.revokeObjectURL(url)
  }
}

function lienzo(w: number, h: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  return canvas
}

function pintar(fuente: CanvasImageSource, w: number, h: number): OffscreenCanvas | HTMLCanvasElement {
  const canvas = lienzo(w, h)
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null
  if (!ctx) throw new ErrorImagen('Tu navegador no puede procesar imágenes.')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(fuente, 0, 0, w, h)
  return canvas
}

async function codificar(canvas: OffscreenCanvas | HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  if ('convertToBlob' in canvas) return canvas.convertToBlob({ type, quality })
  return new Promise((resolve) => (canvas as HTMLCanvasElement).toBlob((b) => resolve(b), type, quality))
}

function aDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader()
    lector.onload = () => resolve(String(lector.result))
    lector.onerror = () => reject(new ErrorImagen('No se pudo comprimir la imagen.'))
    lector.readAsDataURL(blob)
  })
}

/** Data URL `data:image/...;base64,...` → Blob, para el multipart de la API. */
export function blobDesdeDataUrl(dataUrl: string): Blob {
  const m = /^data:(image\/(?:webp|jpeg|png));base64,([A-Za-z0-9+/]+={0,2})$/i.exec(dataUrl)
  if (!m?.[1] || !m[2]) throw new ErrorImagen('No se pudo comprimir la imagen.')
  const bin = atob(m[2])
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: m[1].toLowerCase() })
}

/**
 * Redimensiona la foto y la devuelve como data URL base64.
 * El binario cabe en 100 KB.
 */
export async function compressFoodImage(fileOrBlob: Blob): Promise<string> {
  const fuente = await decodificar(fileOrBlob)
  const ancho = 'naturalWidth' in fuente ? fuente.naturalWidth : fuente.width
  const alto = 'naturalHeight' in fuente ? fuente.naturalHeight : fuente.height
  let lado = LADO_MAYOR
  let calidad = CALIDAD_FOTO
  let mejor: Blob | null = null
  try {
    for (let i = 0; i < 8; i++) {
      const { w, h } = encajeLadoMayor(ancho, alto, lado)
      const canvas = pintar(fuente, w, h)
      const webp = await codificar(canvas, 'image/webp', calidad).catch(() => null)
      const blob = webp && webp.type === 'image/webp' ? webp : await codificar(canvas, 'image/jpeg', calidad).catch(() => null)
      if (!blob) break
      mejor = blob
      if (blob.size <= MAX_FOTO_BYTES) break
      if (calidad > 0.4) calidad = Math.round((calidad - 0.15) * 100) / 100
      else lado = Math.round(lado * 0.75)
      if (lado < 320) break
    }
  } finally {
    if ('close' in fuente) fuente.close()
  }
  if (!mejor) throw new ErrorImagen('No se pudo comprimir la imagen.')
  return aDataUrl(mejor)
}

/** Blob listo para `api.analizar`. Misma compresión que `compressFoodImage`. */
export async function comprimirImagen(file: Blob): Promise<Blob> {
  return blobDesdeDataUrl(await compressFoodImage(file))
}
