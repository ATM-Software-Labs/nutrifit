/**
 * Alias coloquiales → nombre oficial, antes de cualquier llamada a la IA.
 * El mapa base va en el cliente. Lo que la IA resuelve se añade en
 * localStorage (`nf:alias-alimentos`) y la siguiente búsqueda igual es inmediata.
 */
import { buscarLocal, escalar, normalizar } from './buscarAlimentos.ts'
import type { ResultadoAnalisis } from './tipos.ts'

/** Claves ya normalizadas (minúsculas, sin acentos). */
export const ALIAS_BASE: Record<string, string> = {
  pechu: 'Pechuga de pollo',
  'batido prote': 'Proteína de suero en polvo (Whey)',
  'tortitas avena': 'Tortitas de avena caseras',
  monstercita: 'Monster Energy Ultra',
  claras: 'Clara de huevo pasteurizada',
}

const CLAVE_CACHE = 'nf:alias-alimentos'
const MAX_CACHE = 200

interface Aprendido {
  q: string
  nombre: string
}

export interface AliasResuelto {
  clave: string
  display_name: string
}

function memoria(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function leerAprendidos(): Aprendido[] {
  const raw = memoria()?.getItem(CLAVE_CACHE)
  if (!raw) return []
  try {
    const v: unknown = JSON.parse(raw)
    if (!Array.isArray(v)) return []
    return v.filter((e): e is Aprendido => !!e && typeof e.q === 'string' && typeof e.nombre === 'string' && e.q.length >= 2 && e.nombre.length >= 2)
  } catch {
    return []
  }
}

/** Coincidencia exacta del texto buscado, primero en el mapa fijo y luego en la caché local. */
export function resolverAlias(consulta: string): AliasResuelto | null {
  const clave = normalizar(consulta)
  if (clave.length < 2) return null
  const fijo = ALIAS_BASE[clave]
  if (fijo) return { clave, display_name: fijo }
  const aprendido = leerAprendidos().find((e) => e.q === clave)
  return aprendido ? { clave, display_name: aprendido.nombre } : null
}

/** Guarda query cruda → display_name. No pisa el mapa fijo ni un nombre vacío. */
export function recordarAlias(consultaCruda: string, displayName: string): void {
  const q = normalizar(consultaCruda)
  const nombre = displayName.replace(/\s+/g, ' ').trim().slice(0, 120)
  if (q.length < 2 || q.length > 120 || nombre.length < 2 || nombre === 'Sin comida') return
  if (ALIAS_BASE[q]) return
  if (normalizar(nombre) === q) return
  const store = memoria()
  if (!store) return
  const siguiente = [{ q, nombre }, ...leerAprendidos().filter((e) => e.q !== q)].slice(0, MAX_CACHE)
  store.setItem(CLAVE_CACHE, JSON.stringify(siguiente))
}

/** Ingredientes sueltos que la IA ya bautizó, para no volver a preguntarle. */
export function recordarAliasDelAnalisis(consultaCruda: string, resultado: ResultadoAnalisis): void {
  const oficial = (resultado.display_name || resultado.nombre_plato).trim()
  recordarAlias(resultado.input_query || consultaCruda, oficial)
  for (const i of resultado.ingredientes) {
    if (i.input_query && (i.display_name || i.nombre)) recordarAlias(i.input_query, i.display_name || i.nombre)
  }
}

/**
 * Plato listo para la revisión, sin IA. Si el nombre oficial está en la base
 * local, usa su ración y sus macros. Si no (una marca), deja el nombre y
 * los macros a cero para completarlos a mano.
 */
export function resultadoDesdeAlias(consultaCruda: string, displayName: string): ResultadoAnalisis {
  const alimento = alimentoOficial(displayName)
  if (!alimento) {
    return {
      input_query: consultaCruda,
      display_name: displayName,
      nombre_plato: displayName,
      ingredientes: [],
      calorias: 0,
      proteinas: 0,
      carbohidratos: 0,
      grasas: 0,
    }
  }
  const gramos = alimento.racion ?? 100
  const m = escalar(alimento.por100, gramos)
  return {
    input_query: consultaCruda,
    display_name: displayName,
    nombre_plato: displayName,
    ingredientes: [{ nombre: alimento.nombre, display_name: alimento.nombre, input_query: consultaCruda, gramos, ...m }],
    calorias: m.calorias,
    proteinas: m.proteinas,
    carbohidratos: m.carbohidratos,
    grasas: m.grasas,
  }
}

function alimentoOficial(displayName: string) {
  const q = normalizar(displayName)
  const directo = buscarLocal(displayName, null, 5)
  if (directo.length) {
    return directo.find((a) => normalizar(a.nombre) === q || normalizar(a.nombre).startsWith(q) || q.startsWith(normalizar(a.nombre))) ?? directo[0]
  }
  const palabras = q.split(' ').filter((w) => w.length >= 5)
  if (palabras.length < 2) return null
  let mejor: { nombre: string; n: number; alimento: ReturnType<typeof buscarLocal>[number] } | null = null
  for (const p of palabras) {
    for (const a of buscarLocal(p, null, 6)) {
      const n = palabras.filter((w) => normalizar(a.nombre).includes(w)).length
      if (n >= 2 && (!mejor || n > mejor.n)) mejor = { nombre: a.nombre, n, alimento: a }
    }
  }
  return mejor?.alimento ?? null
}
