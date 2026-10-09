/** Cuadrado histórico del JPEG (el envío actual usa el lado mayor, no este cuadrado). */
export const LADO_JPEG = 1024
/** Calidad del JPEG (0–1). El canvas no copia EXIF. */
export const CALIDAD_JPEG = 0.85
/** Primer lado mayor al comprimir. Si el binario pasa de 130 KB se baja el lado. */
export const LADO_FOTO = 1024
/** Lado mayor de reserva, dentro del rango que acepta el análisis. */
export const LADO_MAYOR = 800
/** Por debajo de este lado, y solo entonces, la calidad puede bajar de 0.72. */
export const LADO_MIN = 480
/** Calidad WebP de partida, dentro de 0.72–0.78. El JPEG de reserva usa este mismo valor. */
export const CALIDAD_FOTO = 0.75
/** Suelo de la banda de calidad. */
export const CALIDAD_MIN = 0.72
/** Tope del binario ya comprimido. Una foto que ya cabe no se amplía. */
export const MAX_FOTO_BYTES = 130 * 1024
/** Referencia de la banda baja. No se rellena un archivo para llegar hasta aquí. */
export const MIN_FOTO_BYTES = 70 * 1024

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

/**
 * Mientras el binario pase de 130 KB: primero el lado, y la calidad se queda
 * en la banda. null cuando ya no hay otro paso dentro de esa banda.
 */
export function siguienteCompresion(lado: number, calidad: number): { lado: number; calidad: number } | null {
  if (lado > LADO_MAYOR) return { lado: LADO_MAYOR, calidad }
  if (lado > LADO_MIN) {
    const siguiente = Math.max(LADO_MIN, Math.round(lado * 0.8))
    if (siguiente < lado) return { lado: siguiente, calidad }
  }
  if (calidad > CALIDAD_MIN) return { lado, calidad: CALIDAD_MIN }
  return null
}

/** Último recurso, por debajo de 0.72, para no subir un archivo que no cabe. */
export function calidadDeRescate(calidad: number): number | null {
  const q = Math.round((calidad - 0.08) * 100) / 100
  return q >= 0.5 ? q : null
}
