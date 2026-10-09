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
  username: string | null
  bio: string | null
  avatar_url: string | null
  banner_url: string | null
  es_publico: number
  meta_agua_base_ml: number
  creado_en: string
}

export const COLUMNAS_USUARIO =
  'id, email, nombre, edad, sexo, peso_kg, altura_cm, nivel_actividad, objetivo, meta_calorias, meta_proteinas, meta_carbs, meta_grasas, username, bio, avatar_url, banner_url, es_publico, meta_agua_base_ml, creado_en'

export function obtenerUsuario(env: Env, id: string) {
  return env.DB.prepare(`SELECT ${COLUMNAS_USUARIO} FROM usuarios WHERE id = ?1`).bind(id).first<Usuario>()
}

/** Crea el usuario si no existe (alta por magic link) y devuelve id + email. */
export async function asegurarUsuario(env: Env, email: string): Promise<{ id: string; email: string } | null> {
  await env.DB.prepare('INSERT INTO usuarios (id, email) VALUES (?1, ?2) ON CONFLICT (email) DO NOTHING')
    .bind(crypto.randomUUID(), email)
    .run()
  return env.DB.prepare('SELECT id, email FROM usuarios WHERE email = ?1').bind(email).first<{ id: string; email: string }>()
}
