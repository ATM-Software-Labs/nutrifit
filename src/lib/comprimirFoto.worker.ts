/**
 * Compresión fuera del hilo de la UI. Solo se usa si el navegador tiene
 * OffscreenCanvas dentro de un Worker. Si falla, el hilo principal repite el trabajo.
 */
import { CALIDAD_FOTO, CALIDAD_MIN } from './encajeImagen.ts'
import { elegirBinario } from './bucleFoto.ts'

interface Pedido {
  buffer: ArrayBuffer
  type: string
}

function soltar(canvas: OffscreenCanvas) {
  canvas.width = 0
  canvas.height = 0
}

async function codificar(bitmap: ImageBitmap, w: number, h: number, calidad: number): Promise<Blob | null> {
  const canvas = new OffscreenCanvas(w, h)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, w, h)
  const calidadJpeg = calidad >= CALIDAD_MIN ? CALIDAD_FOTO : calidad
  const webp = await canvas.convertToBlob({ type: 'image/webp', quality: calidad }).catch(() => null)
  const blob = webp && webp.type === 'image/webp' ? webp : await canvas.convertToBlob({ type: 'image/jpeg', quality: calidadJpeg }).catch(() => null)
  soltar(canvas)
  return blob
}

self.onmessage = async (ev: MessageEvent<Pedido>) => {
  const file = new Blob([ev.data.buffer], { type: ev.data.type || 'application/octet-stream' })
  let bitmap: ImageBitmap | null = null
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const blob = await elegirBinario(bitmap.width, bitmap.height, (w, h, calidad) => codificar(bitmap!, w, h, calidad))
    if (!blob) {
      self.postMessage({ ok: false })
      return
    }
    const buffer = await blob.arrayBuffer()
    self.postMessage({ ok: true, buffer, type: blob.type }, { transfer: [buffer] })
  } catch {
    self.postMessage({ ok: false })
  } finally {
    bitmap?.close()
  }
}
