import { json } from '../utils/response.ts'
import type { Handler } from '../utils/env.ts'

/** GET /api/config — configuración PÚBLICA para el frontend (site key de Turnstile). */
export const onRequestGet: Handler = async ({ env }) =>
  json({ turnstileSiteKey: env.TURNSTILE_SITE_KEY ?? null }, { headers: { 'cache-control': 'public, max-age=300' } })
