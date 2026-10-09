import { sumarDias } from './fechas.ts'

/**
 * Días seguidos con registro, acabando hoy.
 * Si hoy aún no tiene registro, la racha sigue contando desde ayer.
 */
export function rachaDias(fechasConRegistro: string[], hoy: string): number {
  const dias = new Set(fechasConRegistro)
  let cursor = dias.has(hoy) ? hoy : sumarDias(hoy, -1)
  let n = 0
  while (dias.has(cursor)) {
    n += 1
    cursor = sumarDias(cursor, -1)
    if (n > 400) break
  }
  return n
}
