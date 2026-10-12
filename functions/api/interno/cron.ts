/**
 * POST /api/interno/cron — dispara la ronda de recordatorios (misma lógica que el Worker
 * nutrifit-cron). Lo llama GitHub Actions cada 15 min mientras la cuenta no tenga hueco
 * para otro Cron Trigger (límite del plan gratuito). Protegido con x-cron-secret.
 */
import type { Handler } from '../../utils/env.ts'
import { json } from '../../utils/response.ts'
import { ejecutar } from '../../../workers/cron/index.ts'

function iguales(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

export const onRequestPost: Handler = async ({ request, env }) => {
  const secreto = (env as { CRON_SECRET?: string }).CRON_SECRET
  if (!secreto || !iguales(request.headers.get('x-cron-secret') ?? '', secreto)) return json({ error: 'No autorizado' }, { status: 401 })
  const r = await ejecutar(env as never)
  return json({ usuarios: r.usuarios, envios: r.envios.length })
}
