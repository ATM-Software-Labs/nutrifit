/**
 * Elige el binario más pequeño que quepa en 130 KB.
 * Empieza en 1024 px y calidad 0.75. Baja el lado antes de salir de 0.72–0.78.
 * Si el primer resultado ya pesa menos de 70 KB, se queda: no se amplía.
 */
import { CALIDAD_FOTO, calidadDeRescate, encajeLadoMayor, LADO_FOTO, MAX_FOTO_BYTES, siguienteCompresion } from './encajeImagen.ts'

export async function elegirBinario(
  ancho: number,
  alto: number,
  codificar: (w: number, h: number, calidad: number) => Promise<Blob | null>,
  ceder?: () => Promise<void>,
): Promise<Blob | null> {
  let lado = LADO_FOTO
  let calidad = CALIDAD_FOTO
  let mejor: Blob | null = null
  let rescate = false
  for (let i = 0; i < 12; i++) {
    if (ceder) await ceder()
    const { w, h } = encajeLadoMayor(ancho, alto, lado)
    const blob = await codificar(w, h, calidad)
    if (!blob) return mejor
    mejor = blob
    if (blob.size <= MAX_FOTO_BYTES) return blob
    if (!rescate) {
      const sig = siguienteCompresion(lado, calidad)
      if (sig) {
        lado = sig.lado
        calidad = sig.calidad
        continue
      }
      rescate = true
    }
    const q = calidadDeRescate(calidad)
    if (q == null) return mejor
    calidad = q
  }
  return mejor
}
