/** Acceso a la tabla usuarios (siempre con prepare().bind()). */
import type { Env } from './env.ts'

export interface Usuario {
  id: string
  email: string
  nombre: string | null
  edad: number | null
  sexo: 'hombre' | 'mujer' | null
  peso_kg: number | null
  altura_cm: number | null
  nivel_actividad: 'sedentario' | 'ligero' | 'moderado' | 'activo' | null
  objetivo: 'deficit' | 'mantenimiento' | 'superavit' | null
  meta_calorias: number | null
  meta_proteinas: number | null
  meta_carbs: number | null
  meta_grasas: number | null
  creado_en: string
}

export const COLUMNAS_USUARIO =
  'id, email, nombre, edad, sexo, peso_kg, altura_cm, nivel_actividad, objetivo, meta_calorias, meta_proteinas, meta_carbs, meta_grasas, creado_en'

export function obtenerUsuario(env: Env, id: string) {
  return env.DB.prepare(`SELECT ${COLUMNAS_USUARIO} FROM usuarios WHERE id = ?1`).bind(id).first<Usuario>()
}
