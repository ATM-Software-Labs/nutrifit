import type { Handler } from '../../../utils/env.ts'
import { prepararAutorizacion } from '../../../utils/googleOAuth.ts'

export const onRequestGet: Handler = async ({ env, request }) => {
  const preparado = await prepararAutorizacion(env, request)
  if (!preparado) {
    return new Response(null, { status: 503, headers: { 'cache-control': 'no-store' } })
  }
  return new Response(null, {
    status: 302,
    headers: {
      Location: preparado.location,
      'Set-Cookie': preparado.cookie,
      'Cache-Control': 'no-store',
    },
  })
}
