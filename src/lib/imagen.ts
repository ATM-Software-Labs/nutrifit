/**
 * Preprocesado de la foto del plato, en el dispositivo, antes de
 * POST /api/alimentos/escanear:
 *   · Worker con OffscreenCanvas si el navegador lo permite; si no, el hilo principal cede entre pasadas;
 *   · el lado mayor empieza en 1024 px y baja (800, luego menos) si el binario pasa de 130 KB;
 *   · WebP entre 0.72 y 0.78, o JPEG a 0.75 si el navegador no codifica WebP;
 *   · una foto que ya cabe, aunque pese menos de 70 KB, no se amplía;
 *   · se vuelve a codificar: el EXIF (GPS incluido) no se copia.
 * La orientación EXIF se aplica antes de pintar. El Blob original no se sube.
 */
import { elegirBinario } from './bucleFoto.ts'
import { CALIDAD_FOTO, CALIDAD_MIN, MAX_FOTO_BYTES } from './encajeImagen.ts'

export class ErrorImagen extends Error {
  codigo: 'lectura' | 'pesada' | 'navegador'
  constructor(message: string, codigo: 'lectura' | 'pesada' | 'navegador' = 'lectura') {
    super(message)
    this.name = 'ErrorImagen'
    this.codigo = codigo
  }
}

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
    throw new ErrorImagen('No hemos podido leer esta imagen. Prueba con una foto JPEG, PNG o WebP.')
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Orientación EXIF (1–8) de un JPEG. PNG y WebP no la traen. */
export function orientacionJpeg(bytes: Uint8Array): number {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return 1
  let o = 2
  while (o + 4 < bytes.length) {
    if (bytes[o] !== 0xff) return 1
    const marker = bytes[o + 1]!
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      o += 2
      continue
    }
    const size = (bytes[o + 2]! << 8) | bytes[o + 3]!
    if (size < 2) return 1
    if (marker === 0xe1 && o + 10 < bytes.length) {
      const start = o + 4
      if (bytes[start] === 0x45 && bytes[start + 1] === 0x78 && bytes[start + 2] === 0x69 && bytes[start + 3] === 0x66) {
        return leerTiff(bytes, start + 6)
      }
    }
    if (marker === 0xda) return 1
    o += 2 + size
  }
  return 1
}

function leerTiff(bytes: Uint8Array, tiff: number): number {
  if (tiff + 8 > bytes.length) return 1
  const le = bytes[tiff] === 0x49 && bytes[tiff + 1] === 0x49
  const u16 = (p: number) => (le ? bytes[p]! | (bytes[p + 1]! << 8) : (bytes[p]! << 8) | bytes[p + 1]!)
  const u32 = (p: number) => (le ? u16(p) | (u16(p + 2) << 16) : (u16(p) << 16) | u16(p + 2))
  if (u16(tiff + 2) !== 42) return 1
  let ifd = tiff + u32(tiff + 4)
  if (ifd + 2 > bytes.length) return 1
  const n = u16(ifd)
  ifd += 2
  for (let i = 0; i < n; i++) {
    const e = ifd + i * 12
    if (e + 12 > bytes.length) return 1
    if (u16(e) === 0x0112) {
      const v = u16(e + 8)
      return v >= 1 && v <= 8 ? v : 1
    }
  }
  return 1
}

async function orientacionDe(file: Blob): Promise<number> {
  try {
    return orientacionJpeg(new Uint8Array(await file.slice(0, 128 * 1024).arrayBuffer()))
  } catch {
    return 1
  }
}

function lienzo(w: number, h: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  return canvas
}

function soltar(canvas: OffscreenCanvas | HTMLCanvasElement) {
  canvas.width = 0
  canvas.height = 0
}

function pintar(fuente: CanvasImageSource, srcW: number, srcH: number, dw: number, dh: number, orientacion: number): OffscreenCanvas | HTMLCanvasElement {
  const canvas = lienzo(dw, dh)
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null
  if (!ctx) throw new ErrorImagen('Tu navegador no puede procesar imágenes.', 'navegador')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  if (orientacion > 1) {
    const w = srcW
    const h = srcH
    switch (orientacion) {
      case 2:
        ctx.transform(-dw / w, 0, 0, dh / h, dw, 0)
        break
      case 3:
        ctx.transform(-dw / w, 0, 0, -dh / h, dw, dh)
        break
      case 4:
        ctx.transform(dw / w, 0, 0, -dh / h, 0, dh)
        break
      case 5:
        ctx.transform(0, dh / w, dw / h, 0, 0, 0)
        break
      case 6:
        ctx.transform(0, dh / w, -dw / h, 0, dw, 0)
        break
      case 7:
        ctx.transform(0, -dh / w, -dw / h, 0, dw, dh)
        break
      case 8:
        ctx.transform(0, -dh / w, dw / h, 0, 0, dh)
        break
      default:
        break
    }
    ctx.drawImage(fuente, 0, 0, w, h)
  } else {
    ctx.drawImage(fuente, 0, 0, dw, dh)
  }
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

function puedeWorker(): boolean {
  return typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap === 'function'
}

/** El Worker solo corre si hay OffscreenCanvas. Un fallo vuelve al hilo principal. */
async function comprimirConWorker(file: Blob): Promise<Blob | null> {
  if (!puedeWorker()) return null
  let buffer: ArrayBuffer
  try {
    buffer = await file.arrayBuffer()
  } catch {
    return null
  }
  return new Promise((resolve) => {
    let worker: Worker
    try {
      worker = new Worker(new URL('./comprimirFoto.worker.ts', import.meta.url), { type: 'module' })
    } catch {
      resolve(null)
      return
    }
    const timer = window.setTimeout(() => {
      worker.terminate()
      resolve(null)
    }, 8000)
    worker.onmessage = (ev: MessageEvent<{ ok: true; buffer: ArrayBuffer; type: string } | { ok: false }>) => {
      window.clearTimeout(timer)
      worker.terminate()
      if (!ev.data || !ev.data.ok) {
        resolve(null)
        return
      }
      resolve(new Blob([ev.data.buffer], { type: ev.data.type || 'image/jpeg' }))
    }
    worker.onerror = () => {
      window.clearTimeout(timer)
      worker.terminate()
      resolve(null)
    }
    try {
      worker.postMessage({ buffer, type: file.type }, [buffer])
    } catch {
      window.clearTimeout(timer)
      worker.terminate()
      resolve(null)
    }
  })
}

const ceder = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

/**
 * Redimensiona la foto y la devuelve como data URL base64.
 * El binario cabe en 130 KB. Si no llega, no se sube.
 */
export async function compressFoodImage(fileOrBlob: Blob): Promise<string> {
  const enWorker = await comprimirConWorker(fileOrBlob)
  if (enWorker && enWorker.size <= MAX_FOTO_BYTES) return aDataUrl(enWorker)

  const fuente = await decodificar(fileOrBlob)
  const crudoAncho = 'naturalWidth' in fuente ? fuente.naturalWidth : fuente.width
  const crudoAlto = 'naturalHeight' in fuente ? fuente.naturalHeight : fuente.height
  const orientacion = fuente instanceof HTMLImageElement ? await orientacionDe(fileOrBlob) : 1
  const gira = orientacion >= 5
  const ancho = gira ? crudoAlto : crudoAncho
  const alto = gira ? crudoAncho : crudoAlto
  try {
    const mejor = await elegirBinario(
      ancho,
      alto,
      async (w, h, calidad) => {
        const canvas = pintar(fuente, crudoAncho, crudoAlto, w, h, orientacion)
        const calidadJpeg = calidad >= CALIDAD_MIN ? CALIDAD_FOTO : calidad
        const webp = await codificar(canvas, 'image/webp', calidad).catch(() => null)
        const blob = webp && webp.type === 'image/webp' ? webp : await codificar(canvas, 'image/jpeg', calidadJpeg).catch(() => null)
        soltar(canvas)
        return blob
      },
      ceder,
    )
    if (!mejor) throw new ErrorImagen('No se pudo comprimir la imagen.')
    if (mejor.size > MAX_FOTO_BYTES) {
      throw new ErrorImagen('La imagen excede el límite permitido. La hemos reajustado, intenta tomarla de nuevo', 'pesada')
    }
    return aDataUrl(mejor)
  } finally {
    if ('close' in fuente) fuente.close()
  }
}

/** Blob listo para `api.analizar`. Misma compresión que `compressFoodImage`. */
export async function comprimirImagen(file: Blob): Promise<Blob> {
  return blobDesdeDataUrl(await compressFoodImage(file))
}
