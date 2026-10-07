import type { Handler } from '../../../utils/env.ts'
import { crearCookieSesion } from '../../../utils/session.ts'
import { asegurarUsuario } from '../../../utils/usuarios.ts'

export const onRequestGet: Handler = async ({ request, env }) => {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')

  if (error || !code) {
    return Response.redirect(`${url.origin}/?error=google_denegado`, 302)
  }

  const clientId = env.GOOGLE_CLIENT_ID
  const clientSecret = env.GOOGLE_CLIENT_SECRET
  const redirectUri = `${url.origin}/api/auth/google/callback`

  if (!clientId || !clientSecret) {
    return new Response('Faltan credenciales de Google OAuth', { status: 500 })
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    })
  })

  if (!tokenRes.ok) {
    return Response.redirect(`${url.origin}/?error=google_token_invalido`, 302)
  }

  const tokenData = (await tokenRes.json()) as { access_token: string }

  const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` }
  })

  if (!userinfoRes.ok) {
    return Response.redirect(`${url.origin}/?error=google_userinfo_fallo`, 302)
  }

  const googleUser = (await userinfoRes.json()) as { email: string }

  if (!googleUser.email) {
    return Response.redirect(`${url.origin}/?error=sin_email`, 302)
  }

  const u = await asegurarUsuario(env, googleUser.email.toLowerCase())
  if (!u) {
    return Response.redirect(`${url.origin}/?error=error_usuario`, 302)
  }

  const cookieSesion = await crearCookieSesion(env, u.id, u.email)

  return new Response(null, {
    status: 302,
    headers: {
      Location: `${url.origin}/`,
      'Set-Cookie': cookieSesion
    }
  })
}
