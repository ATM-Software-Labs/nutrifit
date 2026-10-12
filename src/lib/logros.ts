import { useEffect, useState } from 'react'
import { api } from './api.ts'

export type NivelLogro = 'bronce' | 'plata' | 'oro' | 'diamante'
export interface Logro {
  id: string
  titulo: string
  detalle: string
  icono: string
  nivel: NivelLogro
  meta: number
  progreso: number
  desbloqueado: boolean
  desbloqueado_en: string | null
}
export interface EstadoLogros {
  racha: { actual: number; mejor: number; congelados: string[]; comodinDisponible: boolean; hoyRegistrado: boolean }
  logros: Logro[]
  nuevos: string[]
  semana: { desde: string; hasta: string; diasRegistrados: number; adherenciaPct: number; diasEnObjetivo: number; mediaCalorias: number }
}

const EVENTO = 'nf:logros'
let cache: EstadoLogros | null = null

/** Pide el estado al servidor y avisa a los suscriptores (y de los logros nuevos). */
export async function refrescarLogros(): Promise<EstadoLogros | null> {
  try {
    cache = await api.logros()
    window.dispatchEvent(new CustomEvent(EVENTO, { detail: cache }))
    return cache
  } catch {
    return null
  }
}

export function useLogros(): EstadoLogros | null {
  const [e, setE] = useState<EstadoLogros | null>(cache)
  useEffect(() => {
    const f = (ev: Event) => setE((ev as CustomEvent<EstadoLogros>).detail)
    window.addEventListener(EVENTO, f)
    if (!cache) void refrescarLogros()
    return () => window.removeEventListener(EVENTO, f)
  }, [])
  return e
}

export const COLOR_NIVEL: Record<NivelLogro, string> = {
  bronce: 'text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400',
  plata: 'text-slate-600 bg-slate-100 dark:bg-slate-800/60 dark:text-slate-300',
  oro: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950/40 dark:text-yellow-400',
  diamante: 'text-sky-600 bg-sky-50 dark:bg-sky-950/40 dark:text-sky-400',
}
