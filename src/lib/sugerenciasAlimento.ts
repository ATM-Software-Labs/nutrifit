/**
 * Sugerencias del buscador: solo memoria (alias, historial y la base USDA).
 * No llama a la red ni a la IA.
 */
import { resolverAlias } from './aliasAlimentos.ts'
import { buscarLocal, normalizar, type Alimento } from './buscarAlimentos.ts'
import type { Totales } from './tipos.ts'

export interface EntradaHistorial {
  nombre: string
  por100: Totales
  racion: number | null
  veces: number
}

function coincide(nombre: string, q: string): boolean {
  const n = normalizar(nombre)
  const palabras = n.split(' ').filter(Boolean)
  const terminos = q.split(' ').filter(Boolean)
  if (!terminos.length) return false
  return terminos.every((t) => palabras.some((w) => w.startsWith(t)) || n.includes(t))
}

/** Hasta `max` alimentos oficiales. Menos de 2 letras no devuelve nada. */
export function sugerir(consulta: string, historial: readonly EntradaHistorial[], categoria: number | null = null, max = 5): Alimento[] {
  const oficial = resolverAlias(consulta)?.display_name ?? consulta
  const q = normalizar(oficial)
  if (q.length < 2) return []
  const previas: Alimento[] = historial
    .filter((h) => coincide(h.nombre, q))
    .sort((a, b) => b.veces - a.veces || a.nombre.length - b.nombre.length)
    .map((h) => ({
      id: `hist-${normalizar(h.nombre)}`,
      nombre: h.nombre,
      detalle: 'Lo has usado antes',
      por100: h.por100,
      racion: h.racion,
      fuente: 'local' as const,
    }))
  const vistos = new Set(previas.map((a) => normalizar(a.nombre)))
  const base = buscarLocal(oficial, categoria, 12).filter((a) => {
    const n = normalizar(a.nombre)
    if (vistos.has(n)) return false
    vistos.add(n)
    return true
  })
  return [...previas, ...base].slice(0, Math.max(0, max))
}
