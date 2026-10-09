import type { Handler } from '../../../utils/env.ts'
import { prepararAutorizacion } from '../../../utils/googleOAuth.ts'

export const onRequestGet: Handler = async ({ env, request }) => {
  const preparado = await prepararAutorizacion(env, request)
  if (!preparado) {
    return new Response(null, { status: 503, headers: { 'cache-control': 'no-store' } })
  }
  const cabeceras = {
    'Set-Cookie': preparado.cookie,
    'Cache-Control': 'no-store',
  }
  // El botón pide el JSON para registrar el redirect_uri en la consola y salir hacia Google.
  if (new URL(request.url).searchParams.get('formato') === 'json') {
    const redirectUri = new URL(preparado.location).searchParams.get('redirect_uri') ?? ''
    return new Response(JSON.stringify({ redirect_uri: redirectUri, location: preparado.location }), {
      status: 200,
      headers: { ...cabeceras, 'content-type': 'application/json; charset=utf-8' },
    })
  }
  return new Response(null, {
    status: 302,
    headers: { ...cabeceras, Location: preparado.location },
  })
}
