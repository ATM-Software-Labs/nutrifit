/**
 * POST /api/interno/correo — solo para el Worker nutrifit-cron (cabecera x-cron-secret).
 * Así la clave de Brevo vive únicamente en Pages. Solo envía avisos con baja en un clic.
 */
import { z } from 'zod'
import type { Handler } from '../../utils/env.ts'
import { json } from '../../utils/response.ts'
import { validar } from '../../utils/http.ts'
import { enviarAviso } from '../../utils/email.ts'

const esquema = z.object({
  para: z.string().email().max(200),
  asunto: z.string().max(200),
  html: z.string().max(100_000),
  texto: z.string().max(20_000),
  bajaUrl: z.string().url().startsWith('https://nutri.trujillomingorance.com/api/recordatorios/baja?t='),
})

function iguales(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

export const onRequestPost: Handler = async ({ request, env }) => {
  const secreto = (env as { CRON_SECRET?: string }).CRON_SECRET
  if (!secreto || !iguales(request.headers.get('x-cron-secret') ?? '', secreto)) return json({ error: 'No autorizado' }, { status: 401 })
  const c = validar(esquema, await request.json())
  const ok = await enviarAviso(env, c.para, { asunto: c.asunto, html: c.html, texto: c.texto }, c.bajaUrl)
  return json({ ok }, { status: ok ? 200 : 502 })
}
