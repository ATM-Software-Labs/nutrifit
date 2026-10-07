/**
 * Historial de alimentos elegidos en el buscador.
 * La lectura síncrona sale de localStorage para que el debounce no espere a
 * IndexedDB. La base `nutrifit-local` (tienda `alimentos`) es la copia durable.
 */
import type { Totales } from './tipos.ts'
import { normalizar } from './buscarAlimentos.ts'
import { idbGuardarAlimentos, idbLeerAlimentos } from './localDb.ts'

const CLAVE = 'nf:historial-alimentos'
const MAX = 40

export interface AlimentoRecordado {
  nombre: string
  por100: Totales
  racion: number | null
  veces: number
}

function memoria(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function esNumero(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

export function filtrarHistorial(v: unknown): AlimentoRecordado[] {
  if (!Array.isArray(v)) return []
  const salida: AlimentoRecordado[] = []
  for (const e of v) {
    if (!e || typeof e !== 'object') continue
    const o = e as Record<string, unknown>
    const p = o.por100
    if (!p || typeof p !== 'object') continue
    const m = p as Record<string, unknown>
    const nombre = typeof o.nombre === 'string' ? o.nombre.replace(/\s+/g, ' ').trim().slice(0, 120) : ''
    if (nombre.length < 2) continue
    if (!esNumero(m.calorias) || !esNumero(m.proteinas) || !esNumero(m.carbohidratos) || !esNumero(m.grasas)) continue
    const racion = o.racion === null ? null : esNumero(o.racion) ? o.racion : null
    const veces = esNumero(o.veces) && o.veces > 0 ? Math.round(o.veces) : 1
    salida.push({ nombre, por100: { calorias: m.calorias, proteinas: m.proteinas, carbohidratos: m.carbohidratos, grasas: m.grasas }, racion, veces })
  }
  return salida.slice(0, MAX)
}

/** Lectura inmediata. No abre IndexedDB. */
export function leerHistorial(): AlimentoRecordado[] {
  const raw = memoria()?.getItem(CLAVE)
  if (!raw) return []
  try {
    return filtrarHistorial(JSON.parse(raw))
  } catch {
    return []
  }
}

function guardarLocal(lista: AlimentoRecordado[]) {
  memoria()?.setItem(CLAVE, JSON.stringify(lista))
  void idbGuardarAlimentos(lista)
}

/** Suma una elección. La clave es el nombre normalizado. */
export function recordarAlimento(alimento: { nombre: string; por100: Totales; racion: number | null }): AlimentoRecordado[] {
  const nombre = alimento.nombre.replace(/\s+/g, ' ').trim().slice(0, 120)
  if (nombre.length < 2) return leerHistorial()
  const clave = normalizar(nombre)
  const previos = leerHistorial().filter((e) => normalizar(e.nombre) !== clave)
  const ya = leerHistorial().find((e) => normalizar(e.nombre) === clave)
  const siguiente: AlimentoRecordado[] = [
    { nombre, por100: alimento.por100, racion: alimento.racion, veces: (ya?.veces ?? 0) + 1 },
    ...previos,
  ].slice(0, MAX)
  guardarLocal(siguiente)
  return siguiente
}

/**
 * Al abrir el buscador, IndexedDB manda si tiene lista.
 * Devuelve null si no hay copia durable (se mantiene localStorage).
 */
export async function hidratarHistorial(): Promise<AlimentoRecordado[] | null> {
  try {
    const crudo = await idbLeerAlimentos()
    if (crudo === undefined) return null
    const lista = filtrarHistorial(crudo)
    guardarLocal(lista)
    return lista
  } catch {
    return null
  }
}
