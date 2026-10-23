/** Plan de día entreno/descanso: tipo efectivo de una fecha y metas ajustadas. */
import type { Env } from './env.ts'

export type TipoDia = 'entreno' | 'descanso'
export type Totales = { calorias: number; proteinas: number; carbohidratos: number; grasas: number }
export interface FilaPlan {
  horario_entreno: number
  auto: number
  entreno_kcal: number
  entreno_prot: number
  entreno_carbs: number
  entreno_grasas: number
  descanso_kcal: number
  descanso_prot: number
  descanso_carbs: number
  descanso_grasas: number
  nombres_json: string | null
  porcion_g: number | null
}

export const PLAN_VACIO: FilaPlan = {
  horario_entreno: 0, auto: 1,
  entreno_kcal: 0, entreno_prot: 0, entreno_carbs: 0, entreno_grasas: 0,
  descanso_kcal: 0, descanso_prot: 0, descanso_carbs: 0, descanso_grasas: 0,
  nombres_json: null, porcion_g: null,
}

/** Bit del día de la semana (L=1 … D=64) para una fecha YYYY-MM-DD. */
export function bitDia(fecha: string): number {
  const [y, m, d] = fecha.split('-').map(Number) as [number, number, number]
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0 = domingo
  return 1 << ((dow + 6) % 7)
}

/** Manual > horario (si auto y hay horario) > null (día normal, sin ajuste). */
export function tipoEfectivo(plan: FilaPlan | null, manual: TipoDia | null, fecha: string): { tipo: TipoDia | null; origen: 'manual' | 'horario' | null } {
  if (manual) return { tipo: manual, origen: 'manual' }
  if (!plan || !plan.auto || !plan.horario_entreno) return { tipo: null, origen: null }
  return { tipo: plan.horario_entreno & bitDia(fecha) ? 'entreno' : 'descanso', origen: 'horario' }
}

export function ajustarMetas(base: Totales, plan: FilaPlan | null, tipo: TipoDia | null): Totales {
  if (!plan || !tipo) return base
  const p = tipo === 'entreno' ? 'entreno' : 'descanso'
  const n = (v: number) => Math.max(0, Math.round(v))
  return {
    calorias: n(base.calorias + plan[`${p}_kcal`]),
    proteinas: n(base.proteinas + plan[`${p}_prot`]),
    carbohidratos: n(base.carbohidratos + plan[`${p}_carbs`]),
    grasas: n(base.grasas + plan[`${p}_grasas`]),
  }
}

/** Lee plan + marca manual. Si las tablas aún no existen (migración pendiente) devuelve nulls. */
export async function leerPlanDia(env: Env, usuarioId: string, fecha: string): Promise<{ plan: FilaPlan | null; manual: TipoDia | null }> {
  try {
    const [p, t] = await env.DB.batch([
      env.DB.prepare('SELECT * FROM plan_dia WHERE usuario_id = ?1').bind(usuarioId),
      env.DB.prepare('SELECT tipo FROM tipo_dia WHERE usuario_id = ?1 AND fecha = ?2').bind(usuarioId, fecha),
    ])
    return { plan: (p?.results?.[0] as FilaPlan | undefined) ?? null, manual: ((t?.results?.[0] as { tipo?: TipoDia } | undefined)?.tipo) ?? null }
  } catch {
    return { plan: null, manual: null }
  }
}
