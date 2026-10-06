/** Tipos y utilidades básicas de macronutrientes (se ampliará en fases posteriores). */
export type MacroKey = 'protein' | 'carbs' | 'fats'

export interface Macros {
  protein: number // g
  carbs: number // g
  fats: number // g
}

export const MACRO_LABELS: Record<MacroKey, string> = {
  protein: 'Proteína',
  carbs: 'Carbohidratos',
  fats: 'Grasas',
}

/** kcal = 4·P + 4·C + 9·G */
export function kcalFromMacros({ protein, carbs, fats }: Macros): number {
  return Math.round(protein * 4 + carbs * 4 + fats * 9)
}
