/**
 * GET /api/auth/verificar?token=…
 * Firma + caducidad + un solo uso → crea el usuario si es nuevo → cookie de
 * sesión → 302 a "/". En error, 302 a "/?auth=<motivo>" (la SPA muestra el aviso).
 */
import type { Handler } from '../../utils/env.ts'
import { claveLimite, limitar } from '../../utils/rateLimit.ts'
import { consumirMagicToken } from '../../utils/magicLink.ts'
import { crearCookieSesion } from '../../utils/session.ts'

function redirigir(destino: string, cookie?: string): Response {
  const h = new Headers({ Location: destino, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' })
  if (cookie) h.append('Set-Cookie', cookie)
  return new Response(null, { status: 302, headers: h })
}

export const onRequestGet: Handler = async ({ request, env, data }) => {
  const lim = await limitar(env, await claveLimite('verificar:ip', data.ip), 30, 900)
  if (!lim.permitido) return redirigir('/?auth=limite')

  const token = new URL(request.url).searchParams.get('token') ?? ''
  const r = await consumirMagicToken(env, token)
  if (!r.ok) return redirigir(`/?auth=${r.motivo}`)

  await env.DB.prepare('INSERT INTO usuarios (id, email) VALUES (?1, ?2) ON CONFLICT (email) DO NOTHING')
    .bind(crypto.randomUUID(), r.email)
    .run()
  const u = await env.DB.prepare('SELECT id, email FROM usuarios WHERE email = ?1').bind(r.email).first<{ id: string; email: string }>()
  if (!u) return redirigir('/?auth=error')

  return redirigir('/', await crearCookieSesion(env, u.id, u.email))
}
