/**
 * POST /api/interno/copia — copia diaria de D1 a Supabase (bk_filas).
 * La llama GitHub Actions una vez al día (≈03:10 Europe/Madrid). Protegida con x-cron-secret.
 */
import type { Handler } from '../../utils/env.ts'
import { json } from '../../utils/response.ts'
import { copiarD1ASupabase } from '../../utils/copiaSupabase.ts'

function iguales(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

export const onRequestPost: Handler = async ({ request, env }) => {
  const secreto = (env as { CRON_SECRET?: string }).CRON_SECRET
  if (!secreto || !iguales(request.headers.get('x-cron-secret') ?? '', secreto)) return json({ error: 'No autorizado' }, { status: 401 })
  const r = await copiarD1ASupabase(env)
  if (!r.ok) console.warn('[copia] fallo:', r.error)
  return json(r, { status: r.ok ? 200 : 502 })
}
