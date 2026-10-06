/** Tipos compartidos del frontend (reflejan las respuestas de /api). */
import type { NivelActividad, Objetivo, Sexo } from './macros.ts'

export type TipoComida = 'desayuno' | 'comida' | 'cena' | 'snack'
export const TIPOS_COMIDA: TipoComida[] = ['desayuno', 'comida', 'cena', 'snack']
export const NOMBRE_TIPO: Record<TipoComida, string> = {
  desayuno: 'Desayuno',
  comida: 'Comida',
  cena: 'Cena',
  snack: 'Snacks',
}

export interface Usuario {
  id: string
  email: string
  nombre: string | null
  edad: number | null
  sexo: Sexo | null
  peso_kg: number | null
  altura_cm: number | null
  nivel_actividad: NivelActividad | null
  objetivo: Objetivo | null
  meta_calorias: number | null
  meta_proteinas: number | null
  meta_carbs: number | null
  meta_grasas: number | null
  creado_en: string
}

export interface Ingrediente {
  nombre: string
  gramos: number
  calorias?: number
  proteinas?: number
  carbohidratos?: number
  grasas?: number
}

export interface Comida {
  id: string
  tipo_comida: TipoComida
  descripcion: string
  calorias: number
  proteinas: number
  carbohidratos: number
  grasas: number
  imagen_url: string | null
  fecha: string
  creado_en: string
  ingredientes: Ingrediente[]
  /** Solo en cliente: fila optimista aún no confirmada por el servidor. */
  pendiente?: boolean
}

export interface Totales {
  calorias: number
  proteinas: number
  carbohidratos: number
  grasas: number
}

export interface Resumen {
  fecha: string
  comidas: Record<TipoComida, Comida[]>
  totales: Totales
  metas: Totales | null
  restante: Totales | null
  porcentaje: Totales | null
  agua_ml: number
  num_comidas: number
}

export interface ResultadoAnalisis {
  nombre_plato: string
  ingredientes: Ingrediente[]
  calorias: number
  proteinas: number
  carbohidratos: number
  grasas: number
}

export interface NuevaComida {
  tipo_comida: TipoComida
  descripcion: string
  calorias: number
  proteinas: number
  carbohidratos: number
  grasas: number
  ingredientes?: Ingrediente[]
  fecha: string
}

export interface DatosPerfil {
  nombre: string
  edad: number
  sexo: Sexo
  peso: number
  altura: number
  actividad: NivelActividad
  objetivo: Objetivo
}
