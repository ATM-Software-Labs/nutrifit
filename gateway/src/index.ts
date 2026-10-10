/**
 * API Gateway de api.trujillomingorance.com.
 * POST /v1/nutrifit/vision se analiza aquí (ticket HMAC o X-App-Client-Token).
 * El resto de /v1 se reenvía a Pages. La cookie __Host- queda en este host.
 */
import { verificarFirma } from '../../functions/utils/crypto.ts'
import { destinoDeProxy, URL_PAGINA } from '../../functions/utils/pasarela.ts'
import { payloadTicketValido, PROPOSITO_VISION } from '../../functions/utils/ticketVision.ts'
import type { ContextoGateway, GatewayEnv } from './env.ts'
import { aplicarCabecerasGateway, aplicarCors, dentroDelCupo, esRastreador, ipDeGateway, origenPermitido, origenRechazado, secFetchValido, tokenInternoValido } from './politica.ts'
import { type Fetcher, reenviar } from './proxy.ts'
import { falloCliente, falloLimite, falloOrigen, falloTicket, falloUpstream, respuestaJson } from './respuesta.ts'
import { respuestaPortal } from './portal.ts'
import { analizarVision, type LlamadaVision } from './vision.ts'

function rutaDe(url: URL): string {
  const p = url.pathname
  return p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p
}

function cerrar(request: Request, res: Response): Response {
  const headers = new Headers(res.headers)
  aplicarCabecerasGateway(headers)
  const permitida = origenPermitido(request.headers.get('origin'), new URL(request.url).origin)
  if (permitida) aplicarCors(headers, permitida)
  else headers.append('Vary', 'Origin')
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
}

function leerBearer(request: Request): string | null {
  const m = /^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization') ?? '')
  return m?.[1] ?? null
}

async function identificar(request: Request, env: GatewayEnv): Promise<LlamadaVision | 'bloqueado' | 'anonimo'> {
  const app = request.headers.get('x-app-client-token')
  if (app) return tokenInternoValido(app, env.APP_CLIENT_TOKEN) ? { tipo: 'servicio' } : 'bloqueado'
  if (esRastreador(request.headers.get('user-agent'))) return 'bloqueado'
  if (!secFetchValido(request.headers.get('sec-fetch-site'))) {
    const origin = request.headers.get('origin')
    const webview = origin === 'https://localhost' || origin === 'capacitor://localhost'
    if (!webview) return 'bloqueado'
  }
  const bearer = leerBearer(request)
  if (!bearer || !env.AUTH_SECRET) return 'anonimo'
  const payload = await verificarFirma<unknown>(env.AUTH_SECRET, PROPOSITO_VISION, bearer)
  if (!payloadTicketValido(payload, Math.floor(Date.now() / 1000))) return 'anonimo'
  return { tipo: 'ticket', sub: payload.sub, img: payload.img }
}

export async function atender(request: Request, env: GatewayEnv, ctx: ContextoGateway, fetcher: Fetcher = fetch): Promise<Response> {
  const url = new URL(request.url)
  const ruta = rutaDe(url)
  if (request.method === 'GET' && ruta === '/') return respuestaPortal()

  if (request.method === 'OPTIONS') {
    if (origenRechazado(request.headers.get('origin'), url.origin)) return cerrar(request, falloOrigen())
    return cerrar(request, new Response(null, { status: 204 }))
  }
  if (origenRechazado(request.headers.get('origin'), url.origin)) return cerrar(request, falloOrigen())

  if (request.method === 'GET' && ruta === '/health') {
    return cerrar(request, respuestaJson(200, {
      ok: true,
      servicio: 'nutrifit-api-gateway',
      time: new Date().toISOString(),
      servicios: {
        vision: Boolean(env.GEMINI_API_KEY || env.GROQ_API_KEY || env.TRUJILLO_API_KEY || env.AI),
        limite: Boolean(env.VISION_LIMITE),
      },
    }))
  }

  // La cookie __Host- solo vive en el host que la escribe. Google vuelve a la
  // PWA, así que el inicio tiene que salir de ese mismo host y no de este.
  if (request.method === 'GET' && ruta === '/nutrifit/auth/google') {
    const destino = new URL('/api/auth/google', URL_PAGINA)
    destino.search = url.search
    return cerrar(request, new Response(null, {
      status: 302,
      headers: { Location: destino.toString(), 'Cache-Control': 'no-store' },
    }))
  }

  if (ruta === '/nutrifit/vision') {
    if (request.method !== 'POST') return cerrar(request, respuestaJson(405, { ok: false, error: 'Método no permitido.' }))
    return cerrar(request, await analizarConLimite(request, env, ctx))
  }

  if (ruta === '/nutrifit' || ruta.startsWith('/nutrifit/')) {
    const destino = destinoDeProxy(ruta, url.search, env.PAGES_ORIGIN)
    if (!destino) {
      console.error('[gateway] origen no configurado')
      return cerrar(request, falloUpstream(502))
    }
    return cerrar(request, await reenviar(request, env, destino, fetcher))
  }

  return cerrar(request, respuestaJson(404, { ok: false, error: 'Ruta no encontrada.' }))
}

async function analizarConLimite(request: Request, env: GatewayEnv, ctx: ContextoGateway): Promise<Response> {
  if (!env.VISION_LIMITE) {
    console.error('[gateway] sin limite')
    return falloUpstream(503)
  }
  const ip = ipDeGateway(request)
  let cupoIp = false
  try {
    cupoIp = await dentroDelCupo(env.VISION_LIMITE, [`ip:${ip}`])
  } catch {
    console.error('[gateway] limite no disponible')
    return falloUpstream(503)
  }
  if (!cupoIp) return falloLimite()

  const quien = await identificar(request, env)
  if (quien === 'bloqueado') return falloCliente()
  if (quien === 'anonimo') return falloTicket()
  if (quien.tipo === 'ticket') {
    let cupoUsuario = false
    try {
      cupoUsuario = await dentroDelCupo(env.VISION_LIMITE, [`u:${quien.sub}`])
    } catch {
      console.error('[gateway] limite no disponible')
      return falloUpstream(503)
    }
    if (!cupoUsuario) return falloLimite()
  }
  return analizarVision(request, env, ctx, quien)
}

export default {
  fetch(request: Request, env: GatewayEnv, ctx: ContextoGateway): Promise<Response> {
    return atender(request, env, ctx)
  },
}
