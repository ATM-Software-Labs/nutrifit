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
  username?: string | null
  bio?: string | null
  avatar_url?: string | null
  banner_url?: string | null
  es_publico?: number
  meta_agua_base_ml?: number
  creado_en: string
}

export interface Ingrediente {
  nombre: string
  /** Fragmento coloquial del usuario, si la IA lo separó. */
  input_query?: string
  /** Nombre oficial. La UI usa `nombre`, que ya es este valor. */
  display_name?: string
  /** Medida coloquial ya convertida, p. ej. "1 unidad mediana (~120g)". */
  serving_description?: string
  gramos: number
  /** Rango visual de la foto. No cambia el cálculo, que usa `gramos`. */
  min_gramos?: number
  max_gramos?: number
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

export type CategoriaPlato =
  | 'lacteo'
  | 'carne'
  | 'pescado_marisco'
  | 'fruta'
  | 'verdura'
  | 'legumbre_cereal'
  | 'panaderia'
  | 'bebida'
  | 'plato_elaborado'
  | 'snack'

export interface AlternativaPlato {
  nombre: string
  gramos: number
  calorias: number
  proteinas: number
  carbohidratos: number
  grasas: number
}

export interface ResultadoAnalisis {
  /** Texto original del usuario. Vacío en un análisis por foto. */
  input_query?: string
  /** Título gastronómico del plato. Coincide con nombre_plato. */
  display_name?: string
  nombre_plato: string
  /** Desglose de ingredientes cuando el título no lo cuenta. */
  descripcion?: string
  categoria?: CategoriaPlato
  ingredientes: Ingrediente[]
  calorias: number
  proteinas: number
  carbohidratos: number
  grasas: number
  /** Lecturas alternativas de la foto, como máximo dos. */
  alternativas?: AlternativaPlato[]
}

export interface NuevaComida {
  tipo_comida: TipoComida
  descripcion: string
  calorias: number
  proteinas: number
  carbohidratos: number
  grasas: number
  ingredientes?: Ingrediente[]
  imagen_url?: string | null
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

export interface DiaHistorial extends Totales {
  fecha: string
  num_comidas: number
  agua_ml: number
  peso: number | null
}

export interface Historial {
  desde: string
  hasta: string
  dias: DiaHistorial[]
  metas: Totales | null
  /** Medias sobre los días con comidas (agua: sobre los días con agua). */
  medias: (Totales & { agua_ml: number }) | null
  dias_con_registro: number
  dias_en_objetivo: number
  peso: { inicio: number; fin: number; cambio: number } | null
}

/** Lo que ve el móvil antes de aprobar el acceso de un ordenador. */
export interface InfoVinculo {
  codigo: string
  dispositivo: string
  ubicacion: string | null
  creado_en: number
  expira_en: number
}

export interface ProductoOFF {
  codigo: string
  nombre: string
  marca: string | null
  por100: Totales
  racion: number | null
}
