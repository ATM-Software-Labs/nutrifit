/** Cálculo puro de la alarma del Reloj (separado para poder probarlo sin `cloudflare:workers`). */
export const PERIODO_MS = 5 * 60_000
/** Unos segundos tras cada múltiplo de 5 min, para que las horas "redondas" ya hayan pasado. */
export const DESFASE_MS = 20_000

export function siguienteAlarma(ahora: number): number {
  return Math.floor((ahora - DESFASE_MS) / PERIODO_MS) * PERIODO_MS + PERIODO_MS + DESFASE_MS
}
