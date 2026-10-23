/**
 * API Gateway de api.trujillomingorance.com.
 * POST /nutrifit/vision se analiza aquí (ticket HMAC o X-App-Client-Token).
 * El resto de /v1 se reenvía a Pages. La cookie __Host- queda en este host.
 */
import { verificarFirma } from '../../functions/utils/crypto.ts'
import { secretoPasarela } from '../../functions/utils/ipPasarela.ts'
import { destinoDeProxy, URL_PAGINA } from '../../functions/utils/pasarela.ts'
import { payloadTicketValido, PROPOSITO_VISION } from '../../functions/utils/ticketVision.ts'
import type { ContextoGateway, GatewayEnv } from './env.ts'
import { anadirVary, aplicarCabecerasGateway, aplicarCors, dentroDelCupo, esRastreador, ipDeGateway, origenPermitido, origenRechazado, secFetchValido, tokenInternoValido } from './politica.ts'
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
  else anadirVary(headers, 'Origin')
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
  const secreto = secretoPasarela(env)
  if (!bearer || !secreto) return 'anonimo'
  const payload = await verificarFirma<unknown>(secreto, PROPOSITO_VISION, bearer)
  if (!payloadTicketValido(payload, Math.floor(Date.now() / 1000))) return 'anonimo'
  return { tipo: 'ticket', sub: payload.sub, img: payload.img }
}

/** GET públicos de Pages que no dependen de la sesión. Se sirven desde la caché del borde. */
const RUTAS_PUBLICAS = new Set(['/nutrifit/config', '/nutrifit/app/version'])
const TTL_PUBLICO_S = 300

function cachePorDefecto(): Cache | null {
  const c = (globalThis as { caches?: { default?: Cache } }).caches
  return c?.default ?? null
}

async function publicoConCache(request: Request, env: GatewayEnv, ctx: ContextoGateway, destino: string, fetcher: Fetcher): Promise<Response> {
  const cache = cachePorDefecto()
  const url = new URL(request.url)
  const clave = new Request(`${url.origin}${url.pathname}${url.search}`, { method: 'GET' })
  if (cache) {
    const hit = await cache.match(clave).catch(() => undefined)
    if (hit) {
      const h = new Headers(hit.headers)
      h.set('x-edge-cache', 'HIT')
      return new Response(request.method === 'HEAD' ? null : hit.body, { status: hit.status, headers: h })
    }
  }
  const res = await reenviar(new Request(request.url, { method: 'GET', headers: request.headers }), env, destino, fetcher, true)
  if (!cache || res.status !== 200 || res.headers.has('set-cookie')) return res
  const cc = (res.headers.get('cache-control') ?? '').toLowerCase()
  if (cc.includes('no-store') || cc.includes('private')) return res
  const guardar = new Headers(res.headers)
  guardar.set('cache-control', `public, max-age=${TTL_PUBLICO_S}`)
  guardar.delete('vary')
  const [a, b] = res.body ? res.body.tee() : [null, null]
  ctx.waitUntil(cache.put(clave, new Response(b, { status: 200, headers: guardar })).catch(() => undefined))
  const h = new Headers(res.headers)
  h.set('x-edge-cache', 'MISS')
  return new Response(request.method === 'HEAD' ? null : a, { status: 200, headers: h })
}

export async function atender(request: Request, env: GatewayEnv, ctx: ContextoGateway, fetcher: Fetcher = fetch): Promise<Response> {
  const url = new URL(request.url)
  const ruta = rutaDe(url)
  const lectura = request.method === 'GET' || request.method === 'HEAD'
  if (lectura && ruta === '/') {
    const portal = respuestaPortal()
    return request.method === 'HEAD' ? new Response(null, { status: 200, headers: portal.headers }) : portal
  }
  // Los navegadores piden el icono al abrir el portal; la sonda de Labs pide /favicon.svg.
  if (lectura && (ruta === '/favicon.ico' || ruta === '/favicon.svg' || ruta === '/robots.txt')) {
    if (ruta === '/robots.txt') {
      return new Response(request.method === 'HEAD' ? null : 'User-agent: *\nDisallow: /\n', {
        status: 200,
        headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=86400', 'x-content-type-options': 'nosniff' },
      })
    }
    return new Response(null, { status: 204, headers: { 'cache-control': 'public, max-age=86400', 'x-content-type-options': 'nosniff' } })
  }

  if (request.method === 'OPTIONS') {
    if (origenRechazado(request.headers.get('origin'), url.origin)) return cerrar(request, falloOrigen())
    return cerrar(request, new Response(null, { status: 204 }))
  }
  if (origenRechazado(request.headers.get('origin'), url.origin)) return cerrar(request, falloOrigen())

  if (lectura && ruta === '/health') {
    const cuerpo = respuestaJson(200, {
      ok: true,
      servicio: 'nutrifit-api-gateway',
      time: new Date().toISOString(),
      servicios: {
        vision: Boolean(env.GEMINI_API_KEY || env.GROQ_API_KEY || env.TRUJILLO_API_KEY),
        limite: Boolean(env.VISION_LIMITE),
        pasarela: Boolean(secretoPasarela(env)),
      },
    })
    return cerrar(request, request.method === 'HEAD' ? new Response(null, { status: 200, headers: cuerpo.headers }) : cuerpo)
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

  // Rutas de autenticación unificada para Microsoft Entra ID
  if ((request.method === 'GET' || request.method === 'HEAD') && (ruta === '/nutrifit/auth/microsoft' || ruta === '/v1/auth/microsoft')) {
    const destino = new URL('/api/auth/microsoft', URL_PAGINA)
    destino.search = url.search
    return cerrar(request, new Response(null, {
      status: 302,
      headers: { Location: destino.toString(), 'Cache-Control': 'no-store' },
    }))
  }

  if ((request.method === 'GET' || request.method === 'HEAD') && (ruta === '/v1/auth/callback/microsoft' || ruta === '/nutrifit/auth/callback/microsoft')) {
    const destino = new URL('/api/auth/callback/microsoft', URL_PAGINA)
    destino.search = url.search
    return cerrar(request, new Response(null, {
      status: 302,
      headers: { Location: destino.toString(), 'Cache-Control': 'no-store' },
    }))
  }

  if (ruta === '/nutrifit/vision') {
    if (request.method !== 'POST') return cerrar(request, respuestaJson(405, { ok: false, error: 'Método no permitido.', codigo: 'metodo_no_permitido' }, { allow: 'POST, OPTIONS' }))
    return cerrar(request, await analizarConLimite(request, env, ctx))
  }

  if (ruta === '/nutrifit' || ruta.startsWith('/nutrifit/')) {
    const destino = destinoDeProxy(ruta, url.search, env.PAGES_ORIGIN)
    if (!destino) {
      console.error('[gateway] origen no configurado')
      return cerrar(request, falloUpstream(502))
    }
    if (lectura && RUTAS_PUBLICAS.has(ruta)) return cerrar(request, await publicoConCache(request, env, ctx, destino, fetcher))
    return cerrar(request, await reenviar(request, env, destino, fetcher))
  }

  return cerrar(request, respuestaJson(404, { ok: false, error: 'Ruta no encontrada.', codigo: 'no_encontrado' }))
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
