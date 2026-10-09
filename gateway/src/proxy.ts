/**
 * Reenvía `/v1/*` a Pages. La visión no pasa por aquí.
 * El navegador recibe el Set-Cookie del host api.trujillomingorance.com.
 */
import { CABECERA_FIRMA_IP, CABECERA_VIA, firmarIpCliente } from '../../functions/utils/ipPasarela.ts'
import { reescribirLocation } from '../../functions/utils/pasarela.ts'
import type { GatewayEnv } from './env.ts'
import { ipDeGateway } from './politica.ts'
import { falloUpstream } from './respuesta.ts'

export type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

const NO_COPIAR = new Set([
  'host',
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'te',
  'trailer',
  'content-length',
  'cf-connecting-ip',
  'cf-ray',
  'cf-ipcountry',
  'cf-visitor',
  'cf-worker',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-proto',
  'x-real-ip',
  'x-nf-via',
  'x-nf-client-sig',
  'x-app-client-token',
])

export async function reenviar(request: Request, env: GatewayEnv, destino: string, fetcher: Fetcher = fetch): Promise<Response> {
  const headers = new Headers()
  request.headers.forEach((valor, clave) => {
    if (!NO_COPIAR.has(clave.toLowerCase())) headers.set(clave, valor)
  })
  if (env.AUTH_SECRET) {
    headers.set(CABECERA_VIA, 'gateway')
    headers.set(CABECERA_FIRMA_IP, await firmarIpCliente(env.AUTH_SECRET, ipDeGateway(request)))
  }
  const metodo = request.method.toUpperCase()
  const tieneCuerpo = metodo !== 'GET' && metodo !== 'HEAD'
  let upstream: Response
  try {
    upstream = await fetcher(destino, {
      method: metodo,
      headers,
      body: tieneCuerpo ? request.body : undefined,
      redirect: 'manual',
    })
  } catch {
    console.error('[gateway] origen no disponible')
    return falloUpstream(502)
  }
  return respuestaOrigen(upstream)
}

function respuestaOrigen(upstream: Response): Response {
  const headers = new Headers()
  const cookies = typeof upstream.headers.getSetCookie === 'function' ? upstream.headers.getSetCookie() : []
  upstream.headers.forEach((valor, clave) => {
    const k = clave.toLowerCase()
    if (k === 'set-cookie' || k === 'content-encoding' || k === 'content-length' || k === 'transfer-encoding') return
    if (k.startsWith('access-control-')) return
    headers.append(clave, valor)
  })
  for (const c of cookies) headers.append('set-cookie', c)
  const location = headers.get('location')
  if (location) headers.set('location', reescribirLocation(location))
  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers })
}
