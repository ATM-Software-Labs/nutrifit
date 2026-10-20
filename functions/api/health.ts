import { json } from '../utils/response.ts'
import type { Handler } from '../utils/env.ts'
import { leerEstadoSupabase } from '../utils/saludSupabase.ts'
import { supabaseConfigurado } from '../utils/supabase.ts'

/**
 * GET /api/health (y /api/salud) — comprobación de vida: ping a D1 y estado de la base
 * secundaria (Supabase) según la última ronda del cron. No llama a Supabase: no se
 * puede usar para generar tráfico hacia fuera.
 */
export const onRequestGet: Handler = async ({ env }) => {
  let db = false
  try {
    db = (await env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>())?.ok === 1
  } catch {
    db = false
  }
  const fila = db ? await leerEstadoSupabase(env.DB) : null
  const ahora = Math.floor(Date.now() / 1000)
  const supabase = !supabaseConfigurado(env)
    ? { estado: 'sin_config' as const }
    : fila
      ? {
          // Sin ronda en 2 h: el cron no está corriendo; el estado es desconocido.
          estado: ahora - fila.comprobado_en > 7200 ? ('desconocido' as const) : fila.estado,
          comprobado_en: new Date(fila.comprobado_en * 1000).toISOString(),
          caido_desde: fila.caido_desde ? new Date(fila.caido_desde * 1000).toISOString() : null,
        }
      : { estado: 'desconocido' as const }
  return json({
    ok: true,
    service: 'nutrifit',
    environment: env.ENVIRONMENT ?? 'production',
    db,
    servicios: { d1: db ? 'ok' : 'caido', supabase },
    // Si Supabase falla, la app sigue con D1, Open Food Facts, USDA y la IA.
    precision_reducida: supabase.estado === 'caido' || supabase.estado === 'pausado',
    time: new Date().toISOString(),
  })
}
