/**
 * Compresión de fotos en el cliente antes de subirlas:
 *   · máx. 800×800 manteniendo proporción, respetando la orientación EXIF;
 *   · WebP calidad 0.7 con OffscreenCanvas (fallback a <canvas>);
 *   · si el navegador no codifica WebP (Safari antiguo) → JPEG 0.75.
 * Resultado típico: 40–120 KB (el backend acepta hasta 1,5 MB).
 */
const MAX_LADO = 800
const CALIDAD_WEBP = 0.7
const CALIDAD_JPEG = 0.75

export class ErrorImagen extends Error {}

async function decodificar(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
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

function medidas(w: number, h: number) {
  const k = Math.min(1, MAX_LADO / Math.max(w, h))
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) }
}

async function codificar(
  canvas: OffscreenCanvas | HTMLCanvasElement,
  tipo: 'image/webp' | 'image/jpeg',
  calidad: number,
): Promise<Blob | null> {
  if ('convertToBlob' in canvas) return canvas.convertToBlob({ type: tipo, quality: calidad })
  return new Promise((res) => (canvas as HTMLCanvasElement).toBlob(res, tipo, calidad))
}

export async function comprimirImagen(file: Blob): Promise<Blob> {
  const fuente = await decodificar(file)
  const ancho = 'naturalWidth' in fuente ? fuente.naturalWidth : fuente.width
  const alto = 'naturalHeight' in fuente ? fuente.naturalHeight : fuente.height
  const { w, h } = medidas(ancho, alto)

  let canvas: OffscreenCanvas | HTMLCanvasElement
  if (typeof OffscreenCanvas !== 'undefined') canvas = new OffscreenCanvas(w, h)
  else {
    canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
  }
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null
  if (!ctx) throw new ErrorImagen('Tu navegador no permite procesar imágenes.')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(fuente, 0, 0, w, h)
  if ('close' in fuente) fuente.close()

  // WebP primero; si el navegador devuelve otro tipo (no sabe codificar WebP), JPEG.
  let blob = await codificar(canvas, 'image/webp', CALIDAD_WEBP).catch(() => null)
  if (!blob || blob.type !== 'image/webp') blob = await codificar(canvas, 'image/jpeg', CALIDAD_JPEG)
  if (!blob) throw new ErrorImagen('No se pudo comprimir la imagen.')
  return blob
}
