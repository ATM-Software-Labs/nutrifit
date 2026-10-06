import { json } from '../utils/response'
import type { Env } from '../utils/env'

/** GET /api/health — comprobación de vida de las Pages Functions. */
export const onRequestGet: PagesFunction<Env> = async ({ env }) =>
  json({
    ok: true,
    service: 'nutrifit',
    environment: env.ENVIRONMENT ?? 'development',
    time: new Date().toISOString(),
  })
