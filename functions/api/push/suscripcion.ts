/** POST/DELETE /api/push/suscripcion — guarda o borra la suscripción Web Push del navegador. */
import { z } from 'zod'
import type { Handler } from '../../utils/env.ts'
import { json } from '../../utils/response.ts'
import { exigirSesion } from '../../utils/session.ts'
import { validar } from '../../utils/http.ts'

const esquema = z.object({
  endpoint: z.string().url().max(1000).refine((u) => u.startsWith('https://')),
  keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }),
})

async function hash(s: string) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export const onRequestPost: Handler = async ({ request, env, data }) => {
  const { usuarioId: id } = exigirSesion(data.sesion)
  const s = validar(esquema, await request.json())
  await env.DB.prepare(
    `INSERT INTO push_suscripciones (endpoint_hash, usuario_id, endpoint, p256dh, auth) VALUES (?1, ?2, ?3, ?4, ?5)
     ON CONFLICT (endpoint_hash) DO UPDATE SET usuario_id = ?2, p256dh = ?4, auth = ?5, fallos = 0`,
  ).bind(await hash(s.endpoint), id, s.endpoint, s.keys.p256dh, s.keys.auth).run()
  return json({ ok: true })
}

export const onRequestDelete: Handler = async ({ request, env, data }) => {
  const { usuarioId: id } = exigirSesion(data.sesion)
  const { endpoint } = validar(z.object({ endpoint: z.string().max(1000) }), await request.json())
  await env.DB.prepare('DELETE FROM push_suscripciones WHERE endpoint_hash = ?1 AND usuario_id = ?2').bind(await hash(endpoint), id).run()
  return json({ ok: true })
}

/** PATCH: renovación silenciosa tras rotar la clave VAPID. Borra la suscripción anterior y guarda la nueva. */
export const onRequestPatch: Handler = async ({ request, env, data }) => {
  const { usuarioId: id } = exigirSesion(data.sesion)
  const cuerpo = validar(esquema.extend({ anterior: z.string().max(1000).optional() }), await request.json())
  if (cuerpo.anterior && cuerpo.anterior !== cuerpo.endpoint) {
    await env.DB.prepare('DELETE FROM push_suscripciones WHERE endpoint_hash = ?1 AND usuario_id = ?2').bind(await hash(cuerpo.anterior), id).run()
  }
  await env.DB.prepare(
    `INSERT INTO push_suscripciones (endpoint_hash, usuario_id, endpoint, p256dh, auth) VALUES (?1, ?2, ?3, ?4, ?5)
     ON CONFLICT (endpoint_hash) DO UPDATE SET usuario_id = ?2, p256dh = ?4, auth = ?5, fallos = 0`,
  ).bind(await hash(cuerpo.endpoint), id, cuerpo.endpoint, cuerpo.keys.p256dh, cuerpo.keys.auth).run()
  return json({ ok: true })
}
