/**
 * POST /api/macros/calcular — Mifflin-St Jeor + actividad + objetivo.
 * Público (sin BD ni IA) → sin Turnstile, solo rate limit suave por IP.
 * El cálculo vive en src/lib/macros.ts y lo comparte el frontend.
 */
import type { Handler } from '../../utils/env.ts'
import { json } from '../../utils/response.ts'
import { leerBody } from '../../utils/http.ts'
import { calcularSchema } from '../../utils/schemas.ts'
import { claveLimite, exigirLimite } from '../../utils/rateLimit.ts'
import { calcularMacros, type PlanMacros } from '../../../src/lib/macros.ts'

export const onRequestPost: Handler = async ({ request, env, data }) => {
  await exigirLimite(env, await claveLimite('macros:ip', data.ip), 60, 60)
  const datos = await leerBody(request, calcularSchema)
  const plan: PlanMacros = calcularMacros(datos)
  return json(plan)
}
