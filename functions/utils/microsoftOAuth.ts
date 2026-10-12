/**
 * Microsoft Entra ID OAuth 2.0 / OIDC con state firmado y PKCE.
 * Cookie __Host-nf_microsoft HttpOnly, Secure, SameSite=Lax.
 * Soporta cuentas corporativas de trujillomingorance.com y cuentas Microsoft multiinquilino.
 */
import type { Env } from './env.ts'
import { authSecret, crearCookieSesion, leerCookie } from './session.ts'
import { base64urlEncode, bytesAleatorios, firmar, timingSafeEqual, verificarFirma } from './crypto.ts'
import { origenLocalPages } from './pasarela.ts'
import { sanitizarTextoLibre } from './sanitizar.ts'
import { asegurarUsuario } from './usuarios.ts'

export const COOKIE_MICROSOFT = '__Host-nf_msft'
const MAX_EDAD = 300 // 5 minutos
const PROPOSITO = 'microsoft-oauth'

export const REDIRECT_MICROSOFT_PRODUCCION = 'https://nutri.trujillomingorance.com'
export const RUTA_CALLBACK_MICROSOFT = '/api/auth/callback/microsoft'

/** Origen del callback. En local es el de la petición (localhost). En producción es la PWA. */
export function origenOAuthMicrosoft(env: Env, request: Request): string {
  const local = origenLocalPages(request.url)
  if (local) return local
  const app = env.APP_URL?.trim().replace(/\/+$/, '')
  if (app === REDIRECT_MICROSOFT_PRODUCCION) return app
  return REDIRECT_MICROSOFT_PRODUCCION
}

export function redirectMicrosoftDe(origen: string): string {
  const base = origen.trim().replace(/\/+$/, '')
  return `${base}${RUTA_CALLBACK_MICROSOFT}`
}

export function redirectMicrosoft(env: Env, request: Request): string {
  return redirectMicrosoftDe(origenOAuthMicrosoft(env, request))
}

interface StateMicrosoft {
  n: string
  v: string
  exp: number
}

function secretoMsft(valor: string | undefined): string {
  return valor?.trim() ?? ''
}

function cookieState(token: string, maxAge: number): string {
  return `${COOKIE_MICROSOFT}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`
}

export const cookieMicrosoftBorrado = () => cookieState('', 0)

async function retoS256(verifier: string): Promise<string> {
  const dig = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))
  return base64urlEncode(dig)
}

export async function prepararAutorizacionMicrosoft(
  env: Env,
  request: Request
): Promise<{ location: string; cookie: string } | null> {
  const clientId = secretoMsft(env.MICROSOFT_CLIENT_ID)
  const tenantId = secretoMsft(env.MICROSOFT_TENANT_ID)
  const redirect = redirectMicrosoft(env, request)
  if (!clientId || !tenantId || !redirect || !secretoMsft(env.MICROSOFT_CLIENT_SECRET)) return null

  const nonce = base64urlEncode(bytesAleatorios(32))
  const verifier = base64urlEncode(bytesAleatorios(32))
  const exp = Math.floor(Date.now() / 1000) + MAX_EDAD
  const token = await firmar(authSecret(env), PROPOSITO, { n: nonce, v: verifier, exp } satisfies StateMicrosoft)

  const url = new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirect)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'openid profile email User.Read')
  url.searchParams.set('state', nonce)
  url.searchParams.set('code_challenge', await retoS256(verifier))
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('response_mode', 'query')
  url.searchParams.set('domain_hint', 'trujillomingorance.com')

  return { location: url.toString(), cookie: cookieState(token, MAX_EDAD) }
}

export async function leerStateMicrosoft(env: Env, request: Request): Promise<{ verifier: string } | null> {
  const state = new URL(request.url).searchParams.get('state') ?? ''
  const token = leerCookie(request, COOKIE_MICROSOFT)
  if (!state || !token) return null
  const payload = await verificarFirma<StateMicrosoft>(authSecret(env), PROPOSITO, token)
  if (!payload || typeof payload.n !== 'string' || typeof payload.v !== 'string' || typeof payload.exp !== 'number') return null
  if (payload.exp < Math.floor(Date.now() / 1000)) return null
  if (!timingSafeEqual(payload.n, state)) return null
  if (payload.v.length < 43 || payload.v.length > 128) return null
  return { verifier: payload.v }
}

interface MicrosoftGraphMe {
  id?: string
  displayName?: string
  mail?: string
  userPrincipalName?: string
}

function emailVerificadoMicrosoft(u: MicrosoftGraphMe): string | null {
  const raw = u.mail || u.userPrincipalName || ''
  const email = raw.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return null
  return email
}

export function destinoTrasMicrosoft(env: Env, request: Request, auth = 'error'): string {
  const local = origenLocalPages(request.url)
  if (local) return `${local}/?auth=${auth}`
  const app = env.APP_URL?.trim().replace(/\/$/, '')
  const pagina = app === REDIRECT_MICROSOFT_PRODUCCION ? app : REDIRECT_MICROSOFT_PRODUCCION
  return `${pagina}/?auth=${auth}`
}

function falloOAuth(motivo: string): void {
  console.error('[Microsoft OAuth Error]', motivo)
}

/** Canjea el código devuelto por Microsoft Entra ID y establece la sesión corporativa. */
export async function completarMicrosoft(env: Env, request: Request): Promise<Response> {
  const fallo = (motivo: string, detalle?: string) => {
    falloOAuth(motivo + (detalle ? ': ' + detalle : ''))
    let dest = destinoTrasMicrosoft(env, request, 'error')
    dest += '&motivo=' + encodeURIComponent(motivo)
    if (detalle) dest += '&detalle=' + encodeURIComponent(detalle)
    const h = new Headers({ Location: dest, 'Cache-Control': 'no-store' })
    h.append('Set-Cookie', cookieMicrosoftBorrado())
    return new Response(null, { status: 302, headers: h })
  }

  const url = new URL(request.url)
  if (url.searchParams.get('error') || !url.searchParams.get('code')) {
    return fallo('error_microsoft', url.searchParams.get('error') || 'sin codigo')
  }

  const state = await leerStateMicrosoft(env, request)
  const redirect = redirectMicrosoft(env, request)
  const code = url.searchParams.get('code')
  const clientId = secretoMsft(env.MICROSOFT_CLIENT_ID)
  const clientSecret = secretoMsft(env.MICROSOFT_CLIENT_SECRET)
  const tenantId = secretoMsft(env.MICROSOFT_TENANT_ID)

  if (!state || !redirect || !code || !clientId || !clientSecret || !tenantId) {
    return fallo('configuracion_invalida', !state ? 'state' : 'config')
  }

  let email: string | null = null
  let nombre: string | null = null

  try {
    const tokenRes = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirect,
        grant_type: 'authorization_code',
        code_verifier: state.verifier,
      }),
      signal: AbortSignal.timeout(8000),
    })

    if (!tokenRes.ok) {
      return fallo('error_token', await tokenRes.text())
    }

    const tokenData = (await tokenRes.json()) as { access_token?: string }
    if (!tokenData.access_token) {
      return fallo('sin_access_token')
    }

    const meRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { authorization: `Bearer ${tokenData.access_token}` },
      signal: AbortSignal.timeout(8000),
    })

    if (!meRes.ok) {
      return fallo('error_graph_me', `graph ${meRes.status}`)
    }

    const msUser = (await meRes.json()) as MicrosoftGraphMe
    email = emailVerificadoMicrosoft(msUser)
    const limpio = msUser.displayName ? sanitizarTextoLibre(msUser.displayName).slice(0, 80) : ''
    nombre = limpio || null
  } catch {
    return fallo('error_red')
  }

  if (!email) {
    return fallo('error_email')
  }

  const u = await asegurarUsuario(env, email)
  if (!u) return fallo('error_bd')

  if (u.esNuevo && nombre) {
    await env.DB.prepare('UPDATE usuarios SET nombre = ?1 WHERE id = ?2').bind(nombre, u.id).run()
  }

  const h = new Headers({
    Location: destinoTrasMicrosoft(env, request, 'ok').replace('/?auth=ok', '/'),
    'Cache-Control': 'no-store',
  })
  h.append('Set-Cookie', await crearCookieSesion(env, u.id, u.email))
  h.append('Set-Cookie', cookieMicrosoftBorrado())
  return new Response(null, { status: 302, headers: h })
}
