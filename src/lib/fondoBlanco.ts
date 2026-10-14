/**
 * Fondo blanco en fotos (privacidad). Todo ocurre en el dispositivo:
 * 1. MediaPipe Face Detector busca caras.
 * 2. MediaPipe Interactive Segmenter (MagicTouch) recorta el objeto bajo el
 *    centro del encuadre (plato o envase) y pinta el resto de blanco.
 * 3. Si la segmentación falla o no convence, recorte central y las caras se
 *    tapan con blanco. Si todo falla, se devuelve la imagen recortada sin caras
 *    o, como último recurso, la original (solo si no se detectaron caras).
 * La imagen original nunca se sube: la IA y el almacenamiento reciben la procesada.
 */
const CLAVE = 'nf:fondo_blanco'
export const BLANCO = '#FFFFFF'
const LADO_MAX = 1024
const TIEMPO_MAX_MS = 9000
const LADO_SEG = 384
const PRESUPUESTO_SEG_MS = 3000
/** Centro primero y luego rejilla dentro de la guía de encuadre (80 % central). */
const PUNTOS: [number, number][] = [[0.5, 0.5], [0.5, 0.7], [0.3, 0.5], [0.7, 0.5], [0.5, 0.3], [0.3, 0.7], [0.7, 0.7], [0.3, 0.3], [0.7, 0.3], [0.2, 0.5], [0.8, 0.5], [0.5, 0.15], [0.5, 0.85]]

export function fondoBlancoActivo(): boolean {
  try { return localStorage.getItem(CLAVE) !== '0' } catch { return true }
}
export function setFondoBlanco(v: boolean) {
  try { localStorage.setItem(CLAVE, v ? '1' : '0') } catch { /* sin almacenamiento */ }
}

import { unirRegiones, componenteEn, conMargen, recorteCentral, type Caja } from './fondoBlancoGeom.ts'
export interface ResultadoFondo { blob: Blob; modo: 'segmentado' | 'recorte' | 'desactivado'; caras: number; ms: number }

type Vision = typeof import('@mediapipe/tasks-vision')
let modelos: Promise<{ seg: import('@mediapipe/tasks-vision').InteractiveSegmenterLegacy; caras: import('@mediapipe/tasks-vision').FaceDetector }> | null = null
function cargarModelos() {
  modelos ??= (async () => {
    const v: Vision = await import('@mediapipe/tasks-vision')
    const fs = await v.FilesetResolver.forVisionTasks('/mediapipe')
    const [seg, caras] = await Promise.all([
      v.InteractiveSegmenterLegacy.createFromOptions(fs, { baseOptions: { modelAssetPath: '/mediapipe/magic_touch.tflite' }, outputConfidenceMasks: true, outputCategoryMask: false }),
      v.FaceDetector.createFromOptions(fs, { baseOptions: { modelAssetPath: '/mediapipe/blaze_face_short_range.tflite' }, minDetectionConfidence: 0.5 }),
    ])
    return { seg, caras }
  })()
  modelos.catch(() => { modelos = null })
  return modelos
}

const conTiempo = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<never>((_, r) => setTimeout(() => r(new Error('tiempo')), ms))])

function lienzo(w: number, h: number) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }
const aBlob = (c: HTMLCanvasElement) => new Promise<Blob>((ok, ko) => c.toBlob((b) => (b ? ok(b) : ko(new Error('toBlob'))), 'image/jpeg', 0.92))

function taparCaras(ctx: CanvasRenderingContext2D, caras: Caja[], dx = 0, dy = 0) {
  ctx.fillStyle = BLANCO
  for (const c of caras) { const p = Math.round(Math.max(c.w, c.h) * 0.35); ctx.fillRect(c.x - dx - p, c.y - dy - p, c.w + 2 * p, c.h + 2 * p) }
}

export async function procesarFondoBlanco(archivo: Blob, opciones: { forzar?: boolean } = {}): Promise<ResultadoFondo> {
  const t0 = performance.now()
  if (!opciones.forzar && !fondoBlancoActivo()) return { blob: archivo, modo: 'desactivado', caras: 0, ms: 0 }
  const bmp = await createImageBitmap(archivo, { imageOrientation: 'from-image' } as ImageBitmapOptions)
  const k = Math.min(1, LADO_MAX / Math.max(bmp.width, bmp.height))
  const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k)
  const base = lienzo(w, h)
  base.getContext('2d')!.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  let caras: Caja[] = []
  try {
    const { seg, caras: det } = await conTiempo(cargarModelos(), TIEMPO_MAX_MS)
    caras = det.detect(base).detections.flatMap((d) => (d.boundingBox ? [{ x: d.boundingBox.originX, y: d.boundingBox.originY, w: d.boundingBox.width, h: d.boundingBox.height }] : []))
    // Segmentamos sobre una copia pequeña (rápido en Android medio) y escalamos la máscara.
    const ks = Math.min(1, LADO_SEG / Math.max(w, h))
    const sw = Math.round(w * ks), sh = Math.round(h * ks)
    const peq = lienzo(sw, sh)
    peq.getContext('2d')!.drawImage(base, 0, 0, sw, sh)
    const carasPeq = caras.map((c) => ({ x: c.x * ks, y: c.y * ks, w: c.w * ks, h: c.h * ks }))
    // Rejilla de puntos: se unen TODAS las regiones de comida (dos tostadas, plato + vaso), no solo una.
    const cands: { conf: Float32Array; comp: Uint8Array }[] = []
    const cubierto = new Uint8Array(sw * sh)
    for (const [kx, ky] of PUNTOS) {
      const px = Math.round(kx * (sw - 1)), py = Math.round(ky * (sh - 1))
      if (cubierto[py * sw + px]) continue // ese punto ya cae en una región encontrada
      let conf: Float32Array | null = null
      seg.segment(peq, { keypoint: { x: kx, y: ky } }, (r) => {
        const mk = r.confidenceMasks?.[0]
        if (mk && mk.width === sw && mk.height === sh) conf = mk.getAsFloat32Array().slice()
      })
      const c0 = conf as Float32Array | null
      if (c0) {
        const comp = componenteEn(c0, sw, sh, px, py)
        if (comp) { cands.push({ conf: c0, comp }); for (let i = 0; i < comp.length; i++) if (comp[i]) cubierto[i] = 1 }
      }
      if (performance.now() - t0 > PRESUPUESTO_SEG_MS) break
    }
    const mejor = unirRegiones(cands, sw, sh, carasPeq)
    if (mejor) {
      const m = mejor.m
      const r = conMargen({ x: mejor.caja.x / ks, y: mejor.caja.y / ks, w: mejor.caja.w / ks, h: mejor.caja.h / ks }, w, h)
      r.x = Math.round(r.x); r.y = Math.round(r.y); r.w = Math.round(r.w); r.h = Math.round(r.h)
      const ap = lienzo(sw, sh), apx = ap.getContext('2d')!
      const id = apx.createImageData(sw, sh)
      for (let i = 0; i < m.length; i++) { const a = Math.min(1, Math.max(0, (m[i] - 0.3) / 0.4)); id.data[i * 4 + 3] = Math.round(a * 255) }
      apx.putImageData(id, 0, 0)
      const alfa = lienzo(w, h), actx = alfa.getContext('2d')!
      actx.imageSmoothingQuality = 'high'
      actx.drawImage(ap, 0, 0, w, h)
      actx.globalCompositeOperation = 'source-in'
      actx.drawImage(base, 0, 0)
      const out = lienzo(r.w, r.h), o = out.getContext('2d')!
      o.fillStyle = BLANCO; o.fillRect(0, 0, r.w, r.h)
      o.drawImage(alfa, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h)
      taparCaras(o, caras, r.x, r.y)
      return { blob: await aBlob(out), modo: 'segmentado', caras: caras.length, ms: Math.round(performance.now() - t0) }
    }
  } catch (e) {
    console.warn('[fondoBlanco] segmentación no disponible, uso recorte', e)
  }
  const r = recorteCentral(w, h)
  const out = lienzo(r.w, r.h), o = out.getContext('2d')!
  o.drawImage(base, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h)
  taparCaras(o, caras, r.x, r.y)
  return { blob: await aBlob(out), modo: 'recorte', caras: caras.length, ms: Math.round(performance.now() - t0) }
}
