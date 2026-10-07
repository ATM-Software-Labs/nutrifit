import type { Handler } from '../../../utils/env.ts'

export const onRequestGet: Handler = async ({ env, request }) => {
  const clientId = env.GOOGLE_CLIENT_ID
  if (!clientId) {
    return new Response('Falta GOOGLE_CLIENT_ID en variables de entorno', { status: 500 })
  }

  const url = new URL(request.url)
  const redirectUri = `${url.origin}/api/auth/google/callback`
  const state = crypto.randomUUID()

  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  googleAuthUrl.searchParams.set('client_id', clientId)
  googleAuthUrl.searchParams.set('redirect_uri', redirectUri)
  googleAuthUrl.searchParams.set('response_type', 'code')
  googleAuthUrl.searchParams.set('scope', 'openid email profile')
  googleAuthUrl.searchParams.set('state', state)
  googleAuthUrl.searchParams.set('access_type', 'online')
  googleAuthUrl.searchParams.set('prompt', 'select_account')

  return new Response(null, {
    status: 302,
    headers: {
      Location: googleAuthUrl.toString(),
      'Set-Cookie': `google_oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=300; Secure`
    }
  })
}
