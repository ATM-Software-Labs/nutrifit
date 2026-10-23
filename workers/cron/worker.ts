/**
 * Entrada del Worker nutrifit-cron. Solo arma el Reloj (Durable Object con alarma cada
 * 5 min); la ronda de recordatorios la ejecuta Pages en /api/interno/cron.
 * GET/POST /armar con x-cron-secret: arma la alarma si no lo está y devuelve su estado
 * (lo llama el workflow de GitHub como respaldo, por si la alarma se perdiera).
 */
import { Reloj, type EnvReloj } from './reloj.ts'

export { Reloj }

interface Env extends EnvReloj {
  RELOJ: DurableObjectNamespace<Reloj>
}

function iguales(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

const reloj = (env: Env) => env.RELOJ.get(env.RELOJ.idFromName('principal'))

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    if (url.pathname !== '/armar') return new Response('nutrifit-cron', { status: 404 })
    if (!env.CRON_SECRET || !iguales(req.headers.get('x-cron-secret') ?? '', env.CRON_SECRET)) return new Response('No autorizado', { status: 401 })
    const e = await reloj(env).armar()
    return Response.json({ siguiente: new Date(e.siguiente).toISOString(), ultima: e.ultima ? (JSON.parse(e.ultima) as unknown) : null })
  },
  async scheduled(_c: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(reloj(env).armar())
  },
} satisfies ExportedHandler<Env>
