/**
 * Ventana diaria de volcado a D1. El SHA-256 del id reparte a cada usuario un
 * minuto del día (módulo 1440). Un jitter estable de ±15 minutos evita que
 * quienes caerían en el minuto 0 disparen a la vez. La ventana dura 30 minutos
 * a partir de ese inicio, en Europa/Madrid, la misma zona que el resto de fechas.
 */
import { ZONA_POR_DEFECTO } from './fechas.ts'

export const MINUTOS_DIA = 1440
export const JITTER_MIN = 15
export const ANCHO_VENTANA_MIN = 30

export interface VentanaSync {
  /** Minuto 0–1439 asignado por hash % 1440, antes del jitter. */
  ancla: number
  /** Desvío estable en [−15, +15]. */
  jitter: number
  /** Minuto de inicio ya desviado. */
  inicio: number
  /** Segundo 0–59 dentro del minuto de inicio, para no coincidir en el segundo 0. */
  segundo: number
}

export async function ventanaDeUsuario(usuarioId: string): Promise<VentanaSync> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`nf-ventana:${usuarioId}`))
  const vista = new DataView(buf)
  const ancla = vista.getUint32(0) % MINUTOS_DIA
  const jitter = (vista.getUint32(4) % (JITTER_MIN * 2 + 1)) - JITTER_MIN
  const inicio = (ancla + jitter + MINUTOS_DIA) % MINUTOS_DIA
  const segundo = vista.getUint8(8) % 60
  return { ancla, jitter, inicio, segundo }
}

export function minutoDelDia(ahora = new Date(), zona = ZONA_POR_DEFECTO): number {
  return reloj(ahora, zona).minuto
}

export function reloj(ahora = new Date(), zona = ZONA_POR_DEFECTO): { minuto: number; segundo: number; ms: number } {
  const partes = new Intl.DateTimeFormat('en-GB', {
    timeZone: zona,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(ahora)
  const num = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value ?? 0)
  let hora = num('hour')
  if (hora === 24) hora = 0
  return { minuto: hora * 60 + num('minute'), segundo: num('second'), ms: ahora.getMilliseconds() }
}

/** true si `minuto` cae en [inicio, inicio + ancho) módulo 1440. */
export function enVentana(minuto: number, inicio: number, ancho = ANCHO_VENTANA_MIN): boolean {
  return ((minuto - inicio + MINUTOS_DIA) % MINUTOS_DIA) < ancho
}

export async function dentroDeVentana(usuarioId: string, ahora = new Date()): Promise<boolean> {
  const { inicio } = await ventanaDeUsuario(usuarioId)
  return enVentana(minutoDelDia(ahora), inicio)
}

/** Milisegundos hasta el segundo desviado del inicio. 0 si la ventana ya está abierta. */
export async function msHastaVentana(usuarioId: string, ahora = new Date()): Promise<number> {
  const { inicio, segundo } = await ventanaDeUsuario(usuarioId)
  const ahoraReloj = reloj(ahora)
  if (enVentana(ahoraReloj.minuto, inicio)) {
    if (ahoraReloj.minuto !== inicio) return 0
    const espera = (segundo - ahoraReloj.segundo) * 1000 - ahoraReloj.ms
    return espera > 0 ? espera : 0
  }
  const faltaMin = (inicio - ahoraReloj.minuto + MINUTOS_DIA) % MINUTOS_DIA
  const ms = (faltaMin * 60 + segundo - ahoraReloj.segundo) * 1000 - ahoraReloj.ms
  return ms > 0 ? ms : 0
}

/** Milisegundos hasta que cierre la ventana de 30 minutos. */
export async function msHastaFinVentana(usuarioId: string, ahora = new Date()): Promise<number> {
  const { inicio } = await ventanaDeUsuario(usuarioId)
  const fin = (inicio + ANCHO_VENTANA_MIN) % MINUTOS_DIA
  const ahoraReloj = reloj(ahora)
  const faltaMin = (fin - ahoraReloj.minuto + MINUTOS_DIA) % MINUTOS_DIA
  const ms = (faltaMin * 60 - ahoraReloj.segundo) * 1000 - ahoraReloj.ms
  return ms > 0 ? ms : 1000
}

export function esPrioridadAlta(request: Request): boolean {
  return (request.headers.get('x-sync-prioridad') ?? '').toLowerCase() === 'alta'
}
