/**
 * Limpieza y normalización de la salida de los modelos de visión.
 * Módulo PURO (sin bindings) para poder testearlo con `node --test`.
 *
 *   texto del modelo ──► extraerJson() ──► normalizarAnalisis() ──► ResultadoAnalisis
 *   (con ```fences```,     (primer objeto     (Zod + números saneados,
 *    prosa alrededor…)      {…} equilibrado)   redondeo a 1 decimal)
 */
import { z } from 'zod'
import { MAX } from './schemas.ts'

export class ErrorParseo extends Error {}

/** La foto no es comida o no se distingue. No se inventan ingredientes. */
export const MENSAJE_FOTO_ILEGIBLE = 'No se distingue el alimento con claridad. Intenta enfocar más cerca o con mejor luz.'

export class FotoIlegible extends Error {
  constructor() {
    super(MENSAJE_FOTO_ILEGIBLE)
    this.name = 'FotoIlegible'
  }
}

/** Quita fences Markdown y devuelve el PRIMER objeto JSON equilibrado del texto. */
export function extraerJson(entrada: unknown): unknown {
  if (entrada && typeof entrada === 'object') return entrada // ya viene parseado (modo JSON)
  if (typeof entrada !== 'string') throw new ErrorParseo('Respuesta vacía del modelo')
  let s = entrada.trim().replace(/^\uFEFF/, '')
  // Razonamiento del modelo (Chain-of-Thought) y etiquetas que no son el JSON.
  s = s.replace(/<think>[\s\S]*?<\/think>/gi, '')
  s = s.replace(/<\|thinking\|>[\s\S]*?<\|\/thinking\|>/gi, '')
  // ```json … ```  →  contenido. Si el cierre falta, se quita solo la etiqueta de apertura.
  const fence = s.match(/```(?:json|JSON)?\s*([\s\S]*?)```/)
  if (fence?.[1]?.includes('{')) s = fence[1]
  else s = s.replace(/```(?:json|JSON)?/gi, '')

  const inicio = s.indexOf('{')
  if (inicio < 0) throw new ErrorParseo('No hay ningún objeto JSON en la respuesta')
  let profundidad = 0
  let enCadena = false
  let escape = false
  for (let i = inicio; i < s.length; i++) {
    const c = s[i]
    if (enCadena) {
      if (escape) escape = false
      else if (c === '\\') escape = true
      else if (c === '"') enCadena = false
      continue
    }
    if (c === '"') enCadena = true
    else if (c === '{') profundidad++
    else if (c === '}' && --profundidad === 0) {
      const candidato = s.slice(inicio, i + 1)
      try {
        return JSON.parse(candidato)
      } catch {
        // Reparación mínima: comas colgantes  {"a":1,}  [1,2,]
        try {
          return JSON.parse(candidato.replace(/,\s*([}\]])/g, '$1'))
        } catch {
          throw new ErrorParseo('JSON mal formado en la respuesta del modelo')
        }
      }
    }
  }
  throw new ErrorParseo('JSON incompleto (llaves sin cerrar)')
}

/** "350 kcal" → 350 · "12,5 g" → 12.5 · 7 → 7 · basura → NaN */
function aNumero(v: unknown): unknown {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const m = v.replace(',', '.').match(/-?\d+(?:\.\d+)?/)
    return m ? Number(m[0]) : Number.NaN
  }
  return v
}

const r1 = (n: number) => Math.round(n * 10) / 10

const num = (max: number) =>
  z.preprocess(aNumero, z.number().finite().min(0).max(max)).transform(r1)
const numOpt = (max: number) =>
  z.preprocess((v) => (v === null || v === undefined || v === '' ? undefined : aNumero(v)), z.number().finite().min(0).max(max).optional()).transform(
    (n) => (n === undefined ? undefined : r1(n)),
  )

const limpiarTexto = (max: number) =>
  z
    .string()
    .transform((s) => s.replace(/[<>\u0000-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim().slice(0, max))
    .pipe(z.string().min(1))

const textoOpcional = (max: number) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? v : undefined),
    z
      .string()
      .transform((s) => s.replace(/[<>\u0000-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim().slice(0, max))
      .optional(),
  )

const ingredienteIA = z.object({
  nombre: limpiarTexto(80),
  input_query: textoOpcional(200),
  display_name: textoOpcional(80),
  serving_description: textoOpcional(80),
  gramos: num(MAX.gramos),
  min_gramos: numOpt(MAX.gramos),
  max_gramos: numOpt(MAX.gramos),
  calorias: numOpt(MAX.calorias),
  proteinas: numOpt(MAX.proteinas),
  carbohidratos: numOpt(MAX.carbohidratos),
  grasas: numOpt(MAX.grasas),
})

const alternativaIA = z.object({
  nombre: limpiarTexto(120),
  gramos: num(MAX.gramos),
  calorias: num(MAX.calorias),
  proteinas: num(MAX.proteinas),
  carbohidratos: num(MAX.carbohidratos),
  grasas: num(MAX.grasas),
})

const analisisIA = z.object({
  nombre_plato: limpiarTexto(120),
  input_query: textoOpcional(300),
  display_name: textoOpcional(120),
  ingredientes: z.array(ingredienteIA).max(30).default([]),
  calorias: numOpt(MAX.calorias),
  proteinas: numOpt(MAX.proteinas),
  carbohidratos: numOpt(MAX.carbohidratos),
  grasas: numOpt(MAX.grasas),
  alternativas: z.array(alternativaIA).max(2).optional(),
})

export type IngredienteAnalisis = z.infer<typeof ingredienteIA>
export interface ResultadoAnalisis {
  /** Texto del usuario, sin corregir. Vacío si la entrada fue una foto. */
  input_query: string
  /** Nombre oficial que se muestra y se guarda. */
  display_name: string
  nombre_plato: string
  ingredientes: IngredienteAnalisis[]
  calorias: number
  proteinas: number
  carbohidratos: number
  grasas: number
  /** Hasta 2 lecturas alternativas de la misma foto, para elegirlas con un toque. */
  alternativas?: { nombre: string; gramos: number; calorias: number; proteinas: number; carbohidratos: number; grasas: number }[]
}

type Macro = 'calorias' | 'proteinas' | 'carbohidratos' | 'grasas'
const MACROS: Macro[] = ['calorias', 'proteinas', 'carbohidratos', 'grasas']

const comoTexto = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

function esNoComida(o: Record<string, unknown>): boolean {
  return o.is_food === false || o.is_food === 'false'
}

/** Una foto ilegible corta el análisis. No se convierten en ingredientes los datos inventados. */
function rechazarSiNoEsComida(obj: unknown): void {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return
  const o = obj as Record<string, unknown>
  if (esNoComida(o)) throw new FotoIlegible()
  for (const v of Object.values(o)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && esNoComida(v as Record<string, unknown>)) throw new FotoIlegible()
  }
}

function rangoGramos(it: Record<string, unknown>): { gramos: unknown; min_gramos: unknown; max_gramos: unknown } {
  const min = it.min_grams ?? it.min_gramos
  const max = it.max_grams ?? it.max_gramos
  const medio = typeof min === 'number' && typeof max === 'number' ? Math.round(((min + max) / 2) * 10) / 10 : undefined
  return { gramos: it.grams ?? it.gramos ?? medio, min_gramos: min, max_gramos: max }
}

/** El esquema corto de la foto (`items`/`total`) pasa al ResultadoAnalisis de la app. */
function adaptarEsquemaFoto(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj
  const o = obj as Record<string, unknown>
  if (!Array.isArray(o.items)) return obj
  const total = o.total && typeof o.total === 'object' ? (o.total as Record<string, unknown>) : {}
  const ingredientes = (o.items as Record<string, unknown>[]).map((it) => {
    const oficial = comoTexto(it.display_name) || comoTexto(it.name) || comoTexto(it.nombre)
    const consulta = comoTexto(it.input_query)
    return {
      nombre: oficial,
      input_query: consulta,
      display_name: oficial,
      ...rangoGramos(it),
      calorias: it.calories ?? it.calorias,
      proteinas: it.protein ?? it.proteinas,
      carbohidratos: it.carbs ?? it.carbohidratos,
      grasas: it.fat ?? it.grasas,
    }
  })
  const nombres = ingredientes.map((i) => i.display_name).filter(Boolean)
  const oficialPlato = comoTexto(o.display_name) || (nombres.length ? nombres.slice(0, 4).join(', ') : 'Sin comida')
  const alternativas = leerAlternativas(o)
  return {
    input_query: comoTexto(o.input_query),
    display_name: oficialPlato,
    nombre_plato: oficialPlato,
    ingredientes,
    calorias: total.calories ?? total.calorias,
    proteinas: total.protein ?? total.proteinas,
    carbohidratos: total.carbs ?? total.carbohidratos,
    grasas: total.fat ?? total.grasas,
    ...(alternativas.length ? { alternativas } : {}),
  }
}

function numeroFinito(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0
}

/** Como máximo 2 alternativas completas. Una incompleta se descarta, no tumba el plato. */
function leerAlternativas(o: Record<string, unknown>): { nombre: string; gramos: number; calorias: number; proteinas: number; carbohidratos: number; grasas: number }[] {
  const lista = Array.isArray(o.alternatives) ? o.alternatives : Array.isArray(o.alternativas) ? o.alternativas : []
  const out: { nombre: string; gramos: number; calorias: number; proteinas: number; carbohidratos: number; grasas: number }[] = []
  for (const crudo of lista) {
    if (!crudo || typeof crudo !== 'object') continue
    const it = crudo as Record<string, unknown>
    const nombre = comoTexto(it.display_name) || comoTexto(it.nombre) || comoTexto(it.name)
    const gramos = it.grams ?? it.gramos
    const calorias = it.calories ?? it.calorias
    const proteinas = it.protein ?? it.proteinas
    const carbohidratos = it.carbs ?? it.carbohidratos
    const grasas = it.fat ?? it.grasas
    if (!nombre || !numeroFinito(gramos) || !numeroFinito(calorias) || !numeroFinito(proteinas) || !numeroFinito(carbohidratos) || !numeroFinito(grasas)) continue
    out.push({ nombre, gramos, calorias, proteinas, carbohidratos, grasas })
    if (out.length === 2) break
  }
  return out
}

/** display_name gana al alias coloquial. El texto original se conserva en input_query. */
function canonizarNombres(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj
  const o = { ...(obj as Record<string, unknown>) }
  const oficialPlato = comoTexto(o.display_name) || comoTexto(o.nombre_plato)
  if (oficialPlato) {
    o.display_name = oficialPlato
    o.nombre_plato = oficialPlato
  }
  if (!Array.isArray(o.ingredientes)) return o
  o.ingredientes = o.ingredientes.map((crudo) => {
    if (!crudo || typeof crudo !== 'object') return crudo
    const it = crudo as Record<string, unknown>
    const oficial = comoTexto(it.display_name) || comoTexto(it.nombre)
    return { ...it, nombre: oficial || it.nombre, display_name: oficial || undefined, input_query: typeof it.input_query === 'string' ? it.input_query : undefined }
  })
  return o
}

/** Valida y normaliza el objeto devuelto por el modelo. Lanza ErrorParseo si no es usable. */
export function normalizarAnalisis(obj: unknown): ResultadoAnalisis {
  rechazarSiNoEsComida(obj)
  // Algunos modelos envuelven la respuesta: {"resultado": {...}} / {"response": {...}}
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    const o = obj as Record<string, unknown>
    if (!('nombre_plato' in o) && !('items' in o)) {
      const interno = Object.values(o).find((v) => v && typeof v === 'object' && ('nombre_plato' in (v as object) || 'items' in (v as object)))
      if (interno) obj = interno
    }
  }
  rechazarSiNoEsComida(obj)
  obj = canonizarNombres(adaptarEsquemaFoto(obj))
  const r = analisisIA.safeParse(obj)
  if (!r.success) throw new ErrorParseo('La respuesta del modelo no cumple el esquema: ' + r.error.issues[0]?.message)
  const a = r.data

  // Totales ausentes → suma de ingredientes (si todos traen ese macro).
  const total = {} as Record<Macro, number>
  for (const m of MACROS) {
    const suma = a.ingredientes.every((i) => i[m] !== undefined) && a.ingredientes.length > 0
      ? r1(a.ingredientes.reduce((acc, i) => acc + (i[m] ?? 0), 0))
      : undefined
    const v = a[m] ?? suma
    if (v === undefined) throw new ErrorParseo(`Falta el total de ${m}`)
    total[m] = v
  }
  // Si el modelo no dio kcal coherentes, recalcular con Atwater.
  const kcalMacros = total.proteinas * 4 + total.carbohidratos * 4 + total.grasas * 9
  if (total.calorias === 0 && kcalMacros > 0) total.calorias = r1(kcalMacros)

  const display_name = a.display_name || a.nombre_plato
  const alternativas = a.alternativas ?? []
  return {
    input_query: a.input_query ?? '',
    display_name,
    nombre_plato: display_name,
    ingredientes: a.ingredientes.map((i) => ({ ...i, nombre: i.display_name || i.nombre, display_name: i.display_name || i.nombre })),
    ...total,
    ...(alternativas.length ? { alternativas } : {}),
  }
}

/** Atajo: texto crudo del modelo → resultado normalizado. */
export const parsearRespuestaModelo = (texto: unknown) => normalizarAnalisis(extraerJson(texto))
