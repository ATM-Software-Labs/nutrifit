import { json } from '../utils/response.ts'
import type { Handler } from '../utils/env.ts'

/** GET /api/health — comprobación de vida (incluye ping a D1). */
export const onRequestGet: Handler = async ({ env }) => {
  let db = false
  try {
    db = (await env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>())?.ok === 1
  } catch {
    db = false
  }
  return json({ ok: true, service: 'nutrifit', environment: env.ENVIRONMENT ?? 'production', db, time: new Date().toISOString() })
}
