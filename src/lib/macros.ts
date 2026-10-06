/**
 * Cálculo de macros — módulo PURO compartido entre el frontend (Vite) y las
 * Pages Functions (functions/api/macros/calcular.ts). Sin dependencias de DOM
 * ni de Workers, para que se pueda importar en ambos lados y testear con Node.
 */
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

// ------------------------------------------------------------ objetivos diarios
export const SEXOS = ['hombre', 'mujer'] as const
export const NIVELES_ACTIVIDAD = ['sedentario', 'ligero', 'moderado', 'activo'] as const
export const OBJETIVOS = ['deficit', 'mantenimiento', 'superavit'] as const

export type Sexo = (typeof SEXOS)[number]
export type NivelActividad = (typeof NIVELES_ACTIVIDAD)[number]
export type Objetivo = (typeof OBJETIVOS)[number]

export interface DatosCalculo {
  edad: number // años
  sexo: Sexo
  peso: number // kg
  altura: number // cm
  actividad: NivelActividad
  objetivo: Objetivo
}

export interface PlanMacros {
  tmb: number // tasa metabólica basal (kcal)
  tdee: number // gasto energético diario total (kcal)
  calorias: number // objetivo diario (kcal)
  proteinas: number // g
  carbohidratos: number // g
  grasas: number // g
}

export const MULTIPLICADOR_ACTIVIDAD: Record<NivelActividad, number> = {
  sedentario: 1.2,
  ligero: 1.375,
  moderado: 1.55,
  activo: 1.725,
}

export const AJUSTE_OBJETIVO: Record<Objetivo, number> = {
  deficit: -400,
  mantenimiento: 0,
  superavit: 300,
}

export const PROTEINA_G_KG = 1.8
export const GRASA_G_KG = 0.9
/** Grasa mínima si hay que recortar para que los carbohidratos no sean negativos. */
export const GRASA_MIN_G_KG = 0.6
/** Suelo de seguridad de calorías (no recomendar dietas muy hipocalóricas sin supervisión). */
export const CALORIAS_MINIMAS: Record<Sexo, number> = { hombre: 1500, mujer: 1200 }

/** Mifflin-St Jeor: 10·peso + 6.25·altura − 5·edad + 5 (hombre) / −161 (mujer). */
export function calcularTMB({ edad, sexo, peso, altura }: Pick<DatosCalculo, 'edad' | 'sexo' | 'peso' | 'altura'>) {
  return 10 * peso + 6.25 * altura - 5 * edad + (sexo === 'hombre' ? 5 : -161)
}

export function calcularMacros(d: DatosCalculo): PlanMacros {
  const tmb = calcularTMB(d)
  const tdee = tmb * MULTIPLICADOR_ACTIVIDAD[d.actividad]
  const calorias = Math.max(Math.round(tdee + AJUSTE_OBJETIVO[d.objetivo]), CALORIAS_MINIMAS[d.sexo])

  const proteinas = Math.round(d.peso * PROTEINA_G_KG)
  let grasas = Math.round(d.peso * GRASA_G_KG)
  let restante = calorias - proteinas * 4 - grasas * 9

  // Guarda: si proteína + grasa ya superan las calorías (pesos muy altos con
  // déficit), recortamos grasa hasta el mínimo antes de dejar carbos en 0.
  if (restante < 0) {
    const grasaMin = Math.round(d.peso * GRASA_MIN_G_KG)
    grasas = Math.max(grasaMin, Math.floor((calorias - proteinas * 4) / 9))
    restante = calorias - proteinas * 4 - grasas * 9
  }
  const carbohidratos = Math.max(0, Math.round(restante / 4))

  return { tmb: Math.round(tmb), tdee: Math.round(tdee), calorias, proteinas, carbohidratos, grasas }
}
