/** Ruta antigua. El canje real exige el state firmado y el redirect de APP_URL. */
import type { Handler } from '../../../utils/env.ts'
import { completarGoogle } from '../../../utils/googleOAuth.ts'

export const onRequestGet: Handler = async ({ request, env }) => completarGoogle(env, request)
