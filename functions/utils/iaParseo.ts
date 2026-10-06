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

/** Quita fences Markdown y devuelve el PRIMER objeto JSON equilibrado del texto. */
export function extraerJson(entrada: unknown): unknown {
  if (entrada && typeof entrada === 'object') return entrada // ya viene parseado (modo JSON)
  if (typeof entrada !== 'string') throw new ErrorParseo('Respuesta vacía del modelo')
  let s = entrada.trim().replace(/^\uFEFF/, '')
  // ```json … ```  →  contenido
  const fence = s.match(/```(?:json|JSON)?\s*([\s\S]*?)```/)
  if (fence?.[1]?.includes('{')) s = fence[1]

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

const ingredienteIA = z.object({
  nombre: limpiarTexto(80),
  gramos: num(MAX.gramos),
  calorias: numOpt(MAX.calorias),
  proteinas: numOpt(MAX.proteinas),
  carbohidratos: numOpt(MAX.carbohidratos),
  grasas: numOpt(MAX.grasas),
})

const analisisIA = z.object({
  nombre_plato: limpiarTexto(120),
  ingredientes: z.array(ingredienteIA).max(30).default([]),
  calorias: numOpt(MAX.calorias),
  proteinas: numOpt(MAX.proteinas),
  carbohidratos: numOpt(MAX.carbohidratos),
  grasas: numOpt(MAX.grasas),
})

export type IngredienteAnalisis = z.infer<typeof ingredienteIA>
export interface ResultadoAnalisis {
  nombre_plato: string
  ingredientes: IngredienteAnalisis[]
  calorias: number
  proteinas: number
  carbohidratos: number
  grasas: number
}

type Macro = 'calorias' | 'proteinas' | 'carbohidratos' | 'grasas'
const MACROS: Macro[] = ['calorias', 'proteinas', 'carbohidratos', 'grasas']

/** Valida y normaliza el objeto devuelto por el modelo. Lanza ErrorParseo si no es usable. */
export function normalizarAnalisis(obj: unknown): ResultadoAnalisis {
  // Algunos modelos envuelven la respuesta: {"resultado": {...}} / {"response": {...}}
  if (obj && typeof obj === 'object' && !('nombre_plato' in obj)) {
    const interno = Object.values(obj as Record<string, unknown>).find((v) => v && typeof v === 'object' && 'nombre_plato' in (v as object))
    if (interno) obj = interno
  }
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

  return { nombre_plato: a.nombre_plato, ingredientes: a.ingredientes, ...total }
}

/** Atajo: texto crudo del modelo → resultado normalizado. */
export const parsearRespuestaModelo = (texto: unknown) => normalizarAnalisis(extraerJson(texto))
