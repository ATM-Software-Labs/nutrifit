/**
 * Validación de la tabla nutricional leída por la IA (módulo PURO, testeable).
 *
 *   salida del modelo ─► Zod (números saneados) ─► completar (kJ→kcal, sodio→sal,
 *   por ración ↔ por 100 g) ─► reglas de coherencia ─► Etiqueta + advertencias
 *
 * Reglas (las graves invalidan; el resto se avisa y el usuario revisa antes de guardar):
 *   · por 100 g ningún macro > 100 g; kcal ≤ 900; P + C + G + fibra + sal ≤ 105 g.
 *   · azúcares ≤ hidratos y saturadas ≤ grasas (+0,5 g de margen de redondeo).
 *   · kcal ≈ 4·P + 4·C + 9·G + 2·fibra (tolerancia: máx(15 kcal, 15 %)).
 *   · si hay columna por ración: por100 × ración / 100 ≈ por ración (±15 %).
 */
import { z } from 'zod'
import { ErrorParseo } from './iaParseo.ts'

export interface Valores {
  calorias: number
  proteinas: number
  carbohidratos: number
  grasas: number
  azucares: number | null
  saturadas: number | null
  fibra: number | null
  sal: number | null
}

export interface Etiqueta {
  nombre: string | null
  marca: string | null
  unidad: 'g' | 'ml'
  por100: Valores
  porRacion: Valores | null
  racion: number | null
  advertencias: string[]
}

export class EtiquetaNoLegible extends ErrorParseo {}
/** La foto no es una tabla nutricional: no merece la pena preguntar a otro modelo. */
export class NoEsTabla extends EtiquetaNoLegible {
  definitivo = true
}

const aNumero = (v: unknown): unknown => {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase()
    if (/^(<|trazas?|traces?)/.test(s)) return 0
    const m = s.replace(',', '.').match(/-?\d+(?:\.\d+)?/)
    return m ? Number(m[0]) : null
  }
  return null
}
const num = z.preprocess(aNumero, z.number().finite().min(0).max(5000).nullable()).catch(null)
const texto = z
  .preprocess((v) => (typeof v === 'string' ? v.replace(/[<>\u0000-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim().slice(0, 100) : null), z.string().nullable())
  .transform((s) => (s ? s : null))
  .catch(null)

const valoresIA = z
  .object({ kcal: num, kj: num, proteinas: num, carbohidratos: num, azucares: num, grasas: num, saturadas: num, fibra: num, sal: num, sodio: num })
  .partial()
const etiquetaIA = z.object({
  es_tabla: z.boolean().optional().catch(undefined),
  nombre: texto.optional(),
  marca: texto.optional(),
  unidad: z.enum(['g', 'ml']).optional().catch(undefined),
  por_100: valoresIA.nullable().optional().catch(null),
  por_racion: valoresIA.nullable().optional().catch(null),
  racion: num.optional(),
})

type ValoresIA = z.infer<typeof valoresIA>
const r1 = (n: number) => Math.round(n * 10) / 10
const r2 = (n: number) => Math.round(n * 100) / 100

/** Completa kcal (desde kJ), sal (desde sodio). null si faltan macros básicos. */
function completar(v: ValoresIA | null | undefined): Valores | null {
  if (!v) return null
  const P = v.proteinas ?? null
  const C = v.carbohidratos ?? null
  const G = v.grasas ?? null
  let kcal = v.kcal ?? null
  if (kcal === null && v.kj != null) kcal = v.kj / 4.184
  const conocidos = [P, C, G].filter((x) => x !== null).length
  if (kcal === null && conocidos < 3) return null
  if (kcal !== null && conocidos < 2) return null // solo energía: no sirve
  const sal = v.sal ?? (v.sodio != null ? v.sodio * 2.5 : null)
  return {
    calorias: r1(kcal ?? 4 * (P ?? 0) + 4 * (C ?? 0) + 9 * (G ?? 0) + 2 * (v.fibra ?? 0)),
    proteinas: r1(P ?? 0),
    carbohidratos: r1(C ?? 0),
    grasas: r1(G ?? 0),
    azucares: v.azucares == null ? null : r1(v.azucares),
    saturadas: v.saturadas == null ? null : r1(v.saturadas),
    fibra: v.fibra == null ? null : r1(v.fibra),
    sal: sal == null ? null : r2(sal),
  }
}

function escalarValores(v: Valores, factor: number, redondeo = r1): Valores {
  const f = (x: number | null) => (x === null ? null : redondeo(x * factor))
  return {
    calorias: r1(v.calorias * factor),
    proteinas: redondeo(v.proteinas * factor),
    carbohidratos: redondeo(v.carbohidratos * factor),
    grasas: redondeo(v.grasas * factor),
    azucares: f(v.azucares),
    saturadas: f(v.saturadas),
    fibra: f(v.fibra),
    sal: v.sal === null ? null : r2(v.sal * factor),
  }
}

/** kcal esperadas por Atwater (fibra a 2 kcal/g). */
export const kcalAtwater = (v: Pick<Valores, 'proteinas' | 'carbohidratos' | 'grasas' | 'fibra'>) =>
  4 * v.proteinas + 4 * v.carbohidratos + 9 * v.grasas + 2 * (v.fibra ?? 0)

/** Reglas de coherencia por 100 g. Devuelve { graves, avisos }. */
export function revisarPor100(v: Valores): { graves: string[]; avisos: string[] } {
  const graves: string[] = []
  const avisos: string[] = []
  for (const [k, n] of [['proteínas', v.proteinas], ['hidratos', v.carbohidratos], ['grasas', v.grasas], ['azúcares', v.azucares], ['saturadas', v.saturadas], ['fibra', v.fibra], ['sal', v.sal]] as const) {
    if (n !== null && n > 100) graves.push(`${k}: ${n} g por 100 g es imposible`)
  }
  if (v.calorias > 900) graves.push(`${v.calorias} kcal por 100 g es imposible (máx. 900)`)
  const suma = v.proteinas + v.carbohidratos + v.grasas + (v.fibra ?? 0) + (v.sal ?? 0)
  if (suma > 105) graves.push(`los macros suman ${r1(suma)} g por 100 g`)
  if (v.azucares !== null && v.azucares > v.carbohidratos + 0.5) avisos.push('Los azúcares superan a los hidratos de carbono: revisa ambos valores.')
  if (v.saturadas !== null && v.saturadas > v.grasas + 0.5) avisos.push('Las grasas saturadas superan a las grasas totales: revisa ambos valores.')
  const esperado = kcalAtwater(v)
  if (Math.abs(v.calorias - esperado) > Math.max(15, 0.15 * Math.max(v.calorias, esperado))) {
    avisos.push(`Las calorías (${Math.round(v.calorias)} kcal) no cuadran con los macros (≈ ${Math.round(esperado)} kcal). Revisa los valores.`)
  }
  return { graves, avisos }
}

/** Objeto del modelo → Etiqueta validada. Lanza EtiquetaNoLegible si no se puede usar. */
export function normalizarEtiqueta(obj: unknown): Etiqueta {
  const r = etiquetaIA.safeParse(obj)
  if (!r.success) throw new EtiquetaNoLegible('Respuesta con formato inesperado')
  const e = r.data
  if (e.es_tabla === false && !e.por_100 && !e.por_racion) throw new NoEsTabla('La foto no muestra una tabla nutricional')

  let racion = e.racion ?? null
  if (racion !== null && (racion < 1 || racion > 2000)) racion = null
  let por100 = completar(e.por_100)
  let porRacion = completar(e.por_racion)
  const advertencias: string[] = []

  if (!por100 && porRacion && racion) {
    por100 = escalarValores(porRacion, 100 / racion)
    advertencias.push(`Valores por 100 g calculados a partir de la ración de ${racion} g.`)
  }
  if (!por100) throw new EtiquetaNoLegible('No se leen los valores por 100 g')
  if (porRacion && !racion) porRacion = null
  if (!porRacion && racion) porRacion = escalarValores(por100, racion / 100, r2)

  const { graves, avisos } = revisarPor100(por100)
  if (graves.length) throw new EtiquetaNoLegible('Valores imposibles: ' + graves.join('; '))
  advertencias.push(...avisos)

  if (porRacion && racion && e.por_100 && e.por_racion) {
    const esperado = (por100.calorias * racion) / 100
    if (esperado > 5 && Math.abs(porRacion.calorias - esperado) > 0.15 * esperado + 2) {
      advertencias.push(`La columna por ración no cuadra con ${racion} g: revisa el tamaño de la ración.`)
    }
  }
  return { nombre: e.nombre ?? null, marca: e.marca ?? null, unidad: e.unidad ?? 'g', por100, porRacion, racion, advertencias }
}
