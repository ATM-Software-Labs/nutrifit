/** Periodos del historial: semana (lunes–domingo) o mes natural. */
import { aISO, desdeISO, semanaDe } from './fechas.ts'

export type TipoPeriodo = 'semana' | 'mes'

const fmtMes = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' })
const fmtDia = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' })
const corto = (s: string) => fmtDia.format(desdeISO(s)).replace('.', '')

export function periodo(tipo: TipoPeriodo, ref: string): { desde: string; hasta: string; etiqueta: string } {
  if (tipo === 'semana') {
    const dias = semanaDe(ref)
    const desde = dias[0]!
    const hasta = dias[6]!
    return { desde, hasta, etiqueta: `${corto(desde)} – ${corto(hasta)} ${hasta.slice(0, 4)}` }
  }
  const d = desdeISO(ref)
  const desde = aISO(new Date(d.getFullYear(), d.getMonth(), 1))
  const hasta = aISO(new Date(d.getFullYear(), d.getMonth() + 1, 0))
  const e = fmtMes.format(d)
  return { desde, hasta, etiqueta: e.charAt(0).toUpperCase() + e.slice(1) }
}

/** Fecha de referencia del periodo anterior (-1) o siguiente (+1). */
export function moverPeriodo(tipo: TipoPeriodo, ref: string, delta: number): string {
  const d = desdeISO(ref)
  if (tipo === 'semana') d.setDate(d.getDate() + 7 * delta)
  else d.setMonth(d.getMonth() + delta, 1)
  return aISO(d)
}
