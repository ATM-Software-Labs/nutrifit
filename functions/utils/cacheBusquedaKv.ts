/**
 * Caché de búsquedas públicas de alimentos en Cloudflare KV.
 * La clave es el término en minúsculas, sin espacios sobrantes ni acentos.
 * Un acierto evita Open Food Facts, BEDCA y la ida a D1.
 * Sin binding KV el llamador sigue con la caché de D1 o Turso.
 * Nunca guarda productos del usuario.
 */
import type { Env } from './env.ts'

/** 30 días, en segundos. */
export const TTL_KV_BUSQUEDA_S = 2592000

type Ctx = { env: Env; waitUntil(p: Promise<unknown>): void }

/** `food:platano` a partir de un término ya recortado. Máximo 512 bytes (límite de clave KV). */
export function foodQuery(termino: string, prefijo = 'food'): string | null {
  const base = termino
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (base.length < 2) return null
  const clave = `${prefijo}:${base}`
  return clave.length > 512 ? clave.slice(0, 512) : clave
}

export async function leerKv<T>(env: Env, food_query: string, vale: (v: unknown) => v is T): Promise<T | null> {
  if (!env.KV) return null
  try {
    const crudo = await env.KV.get(food_query)
    if (!crudo) return null
    const datos: unknown = JSON.parse(crudo)
    return vale(datos) ? datos : null
  } catch {
    return null
  }
}

export function guardarKv(ctx: Ctx, food_query: string, datos: unknown) {
  const kv = ctx.env.KV
  if (!kv) return
  let json: string
  try {
    json = JSON.stringify(datos)
  } catch {
    return
  }
  if (json.length > 200_000) return
  ctx.waitUntil(
    kv.put(food_query, json, { expirationTtl: 2592000 }).catch((e: unknown) => {
      console.warn('[kv] búsqueda no guardada:', e instanceof Error ? e.message : e)
    }),
  )
}
