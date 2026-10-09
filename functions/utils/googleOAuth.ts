/**
 * Google OAuth 2.0 con state firmado y PKCE.
 * La cookie es HttpOnly, Secure, SameSite=Lax y dura 5 minutos: Lax hace falta
 * para que el navegador la envíe al volver desde accounts.google.com.
 * El verificador PKCE no viaja en la URL.
 */
import { esProduccion, type Env } from './env.ts'
import { authSecret, crearCookieSesion, leerCookie } from './session.ts'
import { base64urlEncode, bytesAleatorios, firmar, timingSafeEqual, verificarFirma } from './crypto.ts'
import { sanitizarTextoLibre } from './sanitizar.ts'
import { asegurarUsuario } from './usuarios.ts'

export const COOKIE_GOOGLE = '__Host-nf_google'
const MAX_EDAD = 300
const PROPOSITO = 'google-oauth'

interface StateGoogle {
  n: string
  v: string
  exp: number
}

export function redirectGoogle(env: Env, request: Request): string | null {
  const base = env.APP_URL?.trim().replace(/\/$/, '')
  if (base && /^https:\/\/[^\s/]+/i.test(base)) return `${base}/api/auth/callback/google`
  if (!esProduccion(env)) return `${new URL(request.url).origin}/api/auth/callback/google`
  return null
}

function cookieState(token: string, maxAge: number): string {
  return `${COOKIE_GOOGLE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`
}

export const cookieGoogleBorrado = () => cookieState('', 0)

async function retoS256(verifier: string): Promise<string> {
  const dig = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))
  return base64urlEncode(dig)
}

export async function prepararAutorizacion(env: Env, request: Request): Promise<{ location: string; cookie: string } | null> {
  const clientId = env.GOOGLE_CLIENT_ID?.trim()
  const redirect = redirectGoogle(env, request)
  if (!clientId || !redirect || !env.GOOGLE_CLIENT_SECRET?.trim()) return null
  const nonce = base64urlEncode(bytesAleatorios(32))
  const verifier = base64urlEncode(bytesAleatorios(32))
  const exp = Math.floor(Date.now() / 1000) + MAX_EDAD
  const token = await firmar(authSecret(env), PROPOSITO, { n: nonce, v: verifier, exp } satisfies StateGoogle)
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirect)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'openid email profile')
  url.searchParams.set('state', nonce)
  url.searchParams.set('code_challenge', await retoS256(verifier))
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('access_type', 'online')
  url.searchParams.set('prompt', 'select_account')
  return { location: url.toString(), cookie: cookieState(token, MAX_EDAD) }
}

export async function leerStateGoogle(env: Env, request: Request): Promise<{ verifier: string } | null> {
  const state = new URL(request.url).searchParams.get('state') ?? ''
  const token = leerCookie(request, COOKIE_GOOGLE)
  if (!state || !token) return null
  const payload = await verificarFirma<StateGoogle>(authSecret(env), PROPOSITO, token)
  if (!payload || typeof payload.n !== 'string' || typeof payload.v !== 'string' || typeof payload.exp !== 'number') return null
  if (payload.exp < Math.floor(Date.now() / 1000)) return null
  if (!timingSafeEqual(payload.n, state)) return null
  if (payload.v.length < 43 || payload.v.length > 128) return null
  return { verifier: payload.v }
}

interface GoogleUser {
  email?: string
  email_verified?: boolean | string
  name?: string
}

function emailVerificado(u: GoogleUser): string | null {
  const verificado = u.email_verified === true || u.email_verified === 'true'
  const email = u.email?.trim().toLowerCase() ?? ''
  if (!verificado || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return null
  return email
}

export function destinoTrasGoogle(env: Env, request: Request, auth = 'error'): string {
  const base = env.APP_URL?.trim().replace(/\/$/, '')
  const origen = base && /^https:\/\/[^\s/]+/i.test(base) ? base : new URL(request.url).origin
  return `${origen}/?auth=${auth}`
}

/** Canjea el código solo si el state de la cookie cuadra. No devuelve el error de Google. */
export async function completarGoogle(env: Env, request: Request): Promise<Response> {
  const fallo = () => {
    const h = new Headers({ Location: destinoTrasGoogle(env, request), 'Cache-Control': 'no-store' })
    h.append('Set-Cookie', cookieGoogleBorrado())
    return new Response(null, { status: 302, headers: h })
  }
  const url = new URL(request.url)
  if (url.searchParams.get('error') || !url.searchParams.get('code')) return fallo()
  const state = await leerStateGoogle(env, request)
  const redirect = redirectGoogle(env, request)
  const code = url.searchParams.get('code')
  if (!state || !redirect || !code || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return fallo()

  let email: string | null = null
  let nombre: string | null = null
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirect,
        grant_type: 'authorization_code',
        code_verifier: state.verifier,
      }),
      signal: AbortSignal.timeout(8000),
    })
    if (!tokenRes.ok) return fallo()
    const tokenData = (await tokenRes.json()) as { access_token?: string }
    if (!tokenData.access_token) return fallo()
    const infoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { authorization: `Bearer ${tokenData.access_token}` },
      signal: AbortSignal.timeout(8000),
    })
    if (!infoRes.ok) return fallo()
    const googleUser = (await infoRes.json()) as GoogleUser
    email = emailVerificado(googleUser)
    const limpio = googleUser.name ? sanitizarTextoLibre(googleUser.name).slice(0, 80) : ''
    nombre = limpio || null
  } catch {
    return fallo()
  }
  if (!email) return fallo()
  const u = await asegurarUsuario(env, email)
  if (!u) return fallo()
  if (nombre) {
    await env.DB.prepare('UPDATE usuarios SET nombre = ?1 WHERE id = ?2 AND (nombre IS NULL OR nombre = \'\')').bind(nombre, u.id).run()
  }
  const h = new Headers({ Location: destinoTrasGoogle(env, request, 'ok').replace('/?auth=ok', '/'), 'Cache-Control': 'no-store' })
  h.append('Set-Cookie', await crearCookieSesion(env, u.id, u.email))
  h.append('Set-Cookie', cookieGoogleBorrado())
  return new Response(null, { status: 302, headers: h })
}
