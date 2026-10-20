/**
 * Afinado del análisis de la IA con el catálogo de Supabase (base secundaria).
 * La IA identifica los alimentos y estima los gramos; si un nombre coincide con
 * mucha confianza con un plato (receta calculada por ingredientes) o con un alimento
 * genérico (USDA/CIQUAL/tabla NutriFit), se usan sus macros por 100 g escalados a
 * esos gramos. Si no hay coincidencia fiable, se queda la estimación de la IA.
 *
 * Opcional y con timeout corto: si Supabase no responde, se devuelve el análisis tal
 * cual con estado 'no_disponible' (la app muestra «precisión reducida»).
 */
import type { IngredienteAnalisis, ResultadoAnalisis } from './iaParseo.ts'
import { supaFetch, supabaseConfigurado, type SupaEnv } from './supabase.ts'
import { crearCircuitos } from './circuito.ts'

export type EstadoCatalogo = 'ok' | 'no_disponible' | 'sin_config'

export interface Coincidencia {
  texto: string
  tipo: 'comida' | 'alimento'
  clave: string
  nombre: string
  similitud: number
  kcal_100: number | null
  proteinas_100: number | null
  carbohidratos_100: number | null
  grasas_100: number | null
  porcion_g: number | null
}

/** Umbrales medidos con el catálogo real (pg_trgm similarity). */
export const UMBRAL_ALIMENTO = 0.75
export const UMBRAL_COMIDA = 0.8
export const TIMEOUT_CATALOGO_MS = 1500

// Un fallo abre el circuito 60 s en este isolate: las siguientes peticiones ni esperan.
const circuitos = crearCircuitos({ umbral: 1, enfriamientoMs: 60_000 })
export const reiniciarCircuitoCatalogo = () => circuitos.reiniciar()

const sinAcentos = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const CRUDO = /\b(crud[oa]s?|sec[oa]s?|en polvo|deshidratad[oa]s?|harina)\b/

export async function buscarCoincidencias(env: SupaEnv, textos: string[], timeoutMs = TIMEOUT_CATALOGO_MS): Promise<Coincidencia[] | null> {
  const unicos = [...new Set(textos.map((t) => t.trim()).filter((t) => t.length >= 3))].slice(0, 40)
  if (!unicos.length) return []
  if (!circuitos.permite('supabase')) return null
  try {
    const res = await supaFetch(env, 'rpc/nf_coincidencias', { method: 'POST', body: JSON.stringify({ p_textos: unicos }), timeoutMs })
    const filas = (await res.json()) as Coincidencia[]
    circuitos.exito('supabase')
    return Array.isArray(filas) ? filas : []
  } catch (e) {
    circuitos.fallo('supabase')
    console.warn('[catalogo] coincidencias no disponibles:', e instanceof Error ? e.message : e)
    return null
  }
}

/** Mejor coincidencia fiable para un ingrediente (alimento genérico antes que plato). */
export function elegir(texto: string, filas: Coincidencia[]): Coincidencia | null {
  const q = sinAcentos(texto)
  const validas = filas.filter((f) => f.texto === texto && f.kcal_100 !== null && Number.isFinite(f.kcal_100))
  const alimento = validas.find((f) => f.tipo === 'alimento' && f.similitud >= UMBRAL_ALIMENTO && (!CRUDO.test(sinAcentos(f.nombre)) || CRUDO.test(q)))
  const comida = validas.find((f) => f.tipo === 'comida' && f.similitud >= UMBRAL_COMIDA)
  if (alimento && comida) return comida.similitud > alimento.similitud ? comida : alimento
  return alimento ?? comida ?? null
}

const r1 = (n: number) => Math.round(n * 10) / 10

/** Macros del catálogo para esos gramos. null si la diferencia con la IA es absurda (coincidencia dudosa). */
export function macrosDe(c: Coincidencia, gramos: number, ia: { calorias?: number }): Pick<IngredienteAnalisis, 'calorias' | 'proteinas' | 'carbohidratos' | 'grasas'> | null {
  const k = gramos / 100
  const kcal = (c.kcal_100 ?? 0) * k
  const kcalIa = ia.calorias ?? 0
  if (kcalIa > 30 && (kcal > kcalIa * 3 || kcal < kcalIa / 3)) return null
  return { calorias: r1(kcal), proteinas: r1((c.proteinas_100 ?? 0) * k), carbohidratos: r1((c.carbohidratos_100 ?? 0) * k), grasas: r1((c.grasas_100 ?? 0) * k) }
}

export interface Afinado {
  resultado: ResultadoAnalisis
  catalogo: EstadoCatalogo
  /** Ingredientes cuyos macros salen del catálogo. */
  afinados: number
  /** Para el registro: qué casó con qué. */
  detalle: { texto: string; catalogo: string; similitud: number }[]
}

export async function afinarConCatalogo(env: SupaEnv, r: ResultadoAnalisis): Promise<Afinado> {
  if (!supabaseConfigurado(env)) return { resultado: r, catalogo: 'sin_config', afinados: 0, detalle: [] }
  const nombreDe = (i: IngredienteAnalisis) => (i.display_name || i.nombre || '').trim()
  const titulo = (r.display_name || r.nombre_plato || '').trim()
  const textos = [...r.ingredientes.map(nombreDe), ...(r.ingredientes.length <= 1 && titulo ? [titulo] : [])]
  const filas = await buscarCoincidencias(env, textos)
  if (filas === null) return { resultado: r, catalogo: 'no_disponible', afinados: 0, detalle: [] }

  let afinados = 0
  const detalle: Afinado['detalle'] = []
  const ingredientes = r.ingredientes.map((i) => {
    if (!(i.gramos > 0)) return i
    // Un único ingrediente que es el plato entero: también vale el título («Tortilla de patatas»).
    const c = elegir(nombreDe(i), filas) ?? (r.ingredientes.length === 1 && titulo ? elegir(titulo, filas) : null)
    if (!c) return i
    const m = macrosDe(c, i.gramos, i)
    if (!m) return i
    afinados++
    detalle.push({ texto: c.texto, catalogo: c.nombre, similitud: Math.round(c.similitud * 100) / 100 })
    return { ...i, ...m }
  })
  if (!afinados) return { resultado: r, catalogo: 'ok', afinados: 0, detalle }
  const suma = (k: 'calorias' | 'proteinas' | 'carbohidratos' | 'grasas') => r1(ingredientes.reduce((a, i) => a + (i[k] ?? 0), 0))
  return {
    resultado: { ...r, ingredientes, calorias: suma('calorias'), proteinas: suma('proteinas'), carbohidratos: suma('carbohidratos'), grasas: suma('grasas') },
    catalogo: 'ok',
    afinados,
    detalle,
  }
}
