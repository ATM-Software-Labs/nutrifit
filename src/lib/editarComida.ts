/** Lógica pura de la hoja de edición (testeable sin DOM). */
export interface Nutrientes { calorias: number; proteinas: number; carbohidratos: number; grasas: number; fibra: number | null; azucares: number | null; sal: number | null }

const r1 = (n: number) => Math.round(n * 10) / 10

/** Escala todos los nutrientes al cambiar la cantidad (proporcional). */
export function escalarNutrientes(n: Nutrientes, anterior: number, nueva: number): Nutrientes {
  if (!(anterior > 0) || !(nueva >= 0) || anterior === nueva) return n
  const k = nueva / anterior
  const e = (v: number | null) => (v == null ? null : r1(v * k))
  return { calorias: Math.round(n.calorias * k), proteinas: r1(n.proteinas * k), carbohidratos: r1(n.carbohidratos * k), grasas: r1(n.grasas * k), fibra: e(n.fibra), azucares: e(n.azucares), sal: e(n.sal) }
}

/** Cantidad inicial: la guardada, o la suma de gramos de los ingredientes, o 1 ración. */
export function cantidadInicial(c: { cantidad?: number | null; unidad?: string | null; ingredientes?: readonly { gramos?: number }[] }): { cantidad: number; unidad: 'g' | 'ml' | 'unidad' | 'racion' } {
  const u = c.unidad === 'g' || c.unidad === 'ml' || c.unidad === 'unidad' || c.unidad === 'racion' ? c.unidad : null
  if (c.cantidad && c.cantidad > 0) return { cantidad: c.cantidad, unidad: u ?? 'g' }
  const g = (c.ingredientes ?? []).reduce((a, i) => a + (Number.isFinite(i.gramos) ? (i.gramos as number) : 0), 0)
  return g > 0 ? { cantidad: Math.round(g), unidad: 'g' } : { cantidad: 1, unidad: 'racion' }
}

/** Solo los campos que han cambiado (lo que viaja en el PATCH). */
export function diferencias<T extends Record<string, unknown>>(antes: T, despues: T): Partial<T> {
  const out: Partial<T> = {}
  for (const k of Object.keys(despues) as (keyof T)[]) if (despues[k] !== antes[k]) out[k] = despues[k]
  return out
}
