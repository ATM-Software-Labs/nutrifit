/**
 * GET /api/auth/verificar?token=…
 * Firma + caducidad + un solo uso → crea el usuario si es nuevo → cookie de
 * sesión → 302 a "/". En error, 302 a "/?auth=<motivo>" (la SPA muestra el aviso).
 */
import type { Handler } from '../../utils/env.ts'
import { claveLimite, limitar } from '../../utils/rateLimit.ts'
import { consumirMagicToken } from '../../utils/magicLink.ts'
import { cerrarSolicitudesLogin } from '../../utils/codigoLogin.ts'
import { crearCookieSesion } from '../../utils/session.ts'
import { asegurarUsuario } from '../../utils/usuarios.ts'

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

  const u = await asegurarUsuario(env, r.email)
  if (!u) return redirigir('/?auth=error')
  await cerrarSolicitudesLogin(env, r.email) // el código del mismo email deja de valer

  return redirigir('/', await crearCookieSesion(env, u.id, u.email))
}
