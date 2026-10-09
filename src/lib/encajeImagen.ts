/** Cuadrado histórico del JPEG (el envío actual usa el lado mayor, no este cuadrado). */
export const LADO_JPEG = 1024
/** Calidad del JPEG (0–1). El canvas no copia EXIF. */
export const CALIDAD_JPEG = 0.85
/** Lado mayor de la foto que se envía a /api/comidas/analizar. */
export const LADO_MAYOR = 800
/** Calidad WebP o JPEG de esa foto. */
export const CALIDAD_FOTO = 0.75
/** Tope del binario ya comprimido. */
export const MAX_FOTO_BYTES = 100 * 1024

export interface Encaje {
  lado: number
  w: number
  h: number
  x: number
  y: number
}

/**
 * Encaja la foto en un cuadrado de `lado` px.
 * No recorta (la comida de los bordes se conserva) ni amplía (no inventa detalle).
 * `x`/`y` son el origen de las bandas que rellena el canvas.
 */
export function encajeCuadrado(ancho: number, alto: number, lado = LADO_JPEG): Encaje {
  const mayor = Math.max(ancho, alto, 1)
  const k = Math.min(1, lado / mayor)
  const w = Math.max(1, Math.round(Math.max(ancho, 0) * k))
  const h = Math.max(1, Math.round(Math.max(alto, 0) * k))
  return { lado, w, h, x: Math.floor((lado - w) / 2), y: Math.floor((lado - h) / 2) }
}

/** Escala proporcional. El lado mayor queda en `lado` px y no se amplía ni se recorta. */
export function encajeLadoMayor(ancho: number, alto: number, lado = LADO_MAYOR): { w: number; h: number } {
  const mayor = Math.max(ancho, alto, 1)
  const k = Math.min(1, lado / mayor)
  return {
    w: Math.max(1, Math.round(Math.max(ancho, 0) * k)),
    h: Math.max(1, Math.round(Math.max(alto, 0) * k)),
  }
}
