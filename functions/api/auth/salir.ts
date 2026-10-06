import type { Handler } from '../../utils/env.ts'
import { json } from '../../utils/response.ts'
import { cookieBorrada } from '../../utils/session.ts'

/** POST /api/auth/salir — borra la cookie de sesión. */
export const onRequestPost: Handler = async () =>
  json({ ok: true }, { headers: { 'Set-Cookie': cookieBorrada() } })
