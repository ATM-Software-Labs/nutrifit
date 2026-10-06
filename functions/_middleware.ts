/**
 * Middleware global de NutriFit (se ejecuta antes de cada Function).
 * public/_routes.json limita la invocación de Functions a /api/* y /assets/*
 * (este último solo para fijar bien la caché, ver functions/assets/[[ruta]].ts);
 * el resto de estáticos no pasa por aquí (ni consume peticiones de Workers).
 *
 * Para /api/*:
 *   0. CORS SOLO para el WebView de la app Android (https://localhost y
 *      capacitor://localhost): preflight OPTIONS y Access-Control-Allow-Origin,
 *      sin credenciales (la app se autentica con Bearer, nunca con cookie).
 *   1. Carga la sesión (cookie nf_session o Authorization: Bearer) en context.data.sesion.
 *   2. En escrituras (POST/PUT/PATCH/DELETE):
 *        · con Bearer válido no hay riesgo de CSRF (el navegador nunca añade esa
 *          cabecera por su cuenta) → se omite la comprobación de Origin;
 *        · desde el origen de la app sin Bearer solo se aceptan escrituras anónimas
 *          (pedir enlace, canjear token), nunca con cookie;
 *        · resto: Origin obligatorio y en la lista permitida (+ Sec-Fetch-Site ≠ cross-site);
 *        · Content-Type JSON o multipart (bloquea CSRF por formularios "simples");
 *        · rate limit 20/min por IP en /api/comidas/analizar y /analizar-texto;
 *        · Turnstile obligatorio en RUTAS_TURNSTILE.
 *      El resto de escrituras autenticadas se apoyan en sesión + SameSite=Strict
 *      + comprobación de Origin (Turnstile sería impracticable en cada guardado).
 *   3. Manejo de errores genérico (sin filtrar detalles internos) y cabeceras
 *      de seguridad en TODAS las respuestas de la API (_headers no aplica a Functions).
 */
import type { Datos, Env, Handler } from './utils/env.ts'
import { error, HttpError } from './utils/response.ts'
import { ipCliente, leerJson } from './utils/http.ts'
import { leerSesion } from './utils/session.ts'
import { verificarTurnstile } from './utils/turnstile.ts'
import { claveLimite, exigirLimite, limpiezaOportunista } from './utils/rateLimit.ts'

const ESCRITURA = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/** Escrituras que exigen Turnstile (anónimas o caras). */
export const RUTAS_TURNSTILE = new Set(['/api/auth/solicitar', '/api/usuarios/perfil', '/api/comidas/analizar', '/api/comidas/analizar-texto', '/api/alimentos/etiqueta'])
/** Rutas con Turnstile que además requieren sesión: se comprueba ANTES de gastar el token. */
const RUTAS_SESION_PREVIA = new Set(['/api/usuarios/perfil', '/api/comidas/analizar', '/api/comidas/analizar-texto', '/api/alimentos/etiqueta'])
/** Rutas que llaman a la IA: 20/min por IP además del límite diario por usuario. */
const RUTAS_IA = new Set(['/api/comidas/analizar', '/api/comidas/analizar-texto', '/api/alimentos/etiqueta'])

/** Orígenes del WebView de Capacitor (APK). */
export const ORIGENES_APP = new Set(['https://localhost', 'capacitor://localhost'])

export function cabecerasCors(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, CF-Turnstile-Token',
    'Access-Control-Expose-Headers': 'Retry-After',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

const MAX_JSON_ANALIZAR = 2_300_000 // ~1.5 MB de imagen en base64 + margen

function origenesPermitidos(env: Env, url: URL): Set<string> {
  const extra = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean)
  return new Set([url.origin, ...extra])
}

function comprobarOrigen(request: Request, env: Env, url: URL) {
  if (request.headers.get('Sec-Fetch-Site') === 'cross-site') {
    throw new HttpError(403, 'Origen no permitido.', { codigo: 'origen' })
  }
  const origin = request.headers.get('Origin')
  if (!origin || !origenesPermitidos(env, url).has(origin)) {
    throw new HttpError(403, 'Origen no permitido.', { codigo: 'origen' })
  }
}

function comprobarContentType(request: Request) {
  const ct = (request.headers.get('content-type') ?? '').toLowerCase()
  if (!ct) return // sin cuerpo (DELETE, /auth/salir); los handlers con cuerpo exigen JSON
  if (!ct.startsWith('application/json') && !ct.startsWith('multipart/form-data')) {
    throw new HttpError(415, 'Tipo de contenido no soportado.')
  }
}

/** Token de Turnstile: cabecera CF-Turnstile-Token, campo JSON o campo de formulario. */
async function extraerTokenTurnstile(request: Request, pathname: string): Promise<string | null> {
  const cabecera = request.headers.get('CF-Turnstile-Token')
  if (cabecera) return cabecera.trim()
  const ct = (request.headers.get('content-type') ?? '').toLowerCase()
  const copia = request.clone()
  try {
    if (ct.startsWith('application/json')) {
      const max = pathname === '/api/comidas/analizar' || pathname === '/api/alimentos/etiqueta' ? MAX_JSON_ANALIZAR : undefined
      const body = (await leerJson(copia, max)) as Record<string, unknown> | null
      const t = body?.turnstileToken ?? body?.['cf-turnstile-response']
      return typeof t === 'string' ? t : null
    }
    if (ct.startsWith('multipart/form-data')) {
      const form = await copia.formData()
      const t = form.get('turnstileToken') ?? form.get('cf-turnstile-response')
      return typeof t === 'string' ? t : null
    }
  } catch (e) {
    if (e instanceof HttpError) throw e
  }
  return null
}

function conCabecerasSeguridad(res: Response, originApp?: string | null): Response {
  const r = new Response(res.body, res) // copia mutable
  const h = r.headers
  if (originApp) for (const [k, v] of Object.entries(cabecerasCors(originApp))) h.set(k, v)
  else h.append('Vary', 'Origin')
  h.set('X-Content-Type-Options', 'nosniff')
  h.set('X-Frame-Options', 'DENY')
  h.set('Referrer-Policy', 'no-referrer')
  h.set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'")
  h.set('Cross-Origin-Resource-Policy', 'same-origin')
  if (!h.has('cache-control')) h.set('Cache-Control', 'no-store')
  return r
}

function manejarError(e: unknown): Response {
  if (e instanceof HttpError) return error(e.status, e.message, e.extra, e.headers)
  console.error('[api] error no controlado:', e instanceof Error ? (e.stack ?? e.message) : e)
  return error(500, 'Error interno. Inténtalo de nuevo más tarde.')
}

export const onRequest: Handler = async (ctx) => {
  const { request, env } = ctx
  const url = new URL(request.url)
  if (!url.pathname.startsWith('/api/')) return ctx.next()

  const origin = request.headers.get('Origin')
  const originApp = origin && ORIGENES_APP.has(origin) ? origin : null

  // Preflight CORS: solo lo contestamos para la app; cualquier otro origen, 403.
  if (request.method === 'OPTIONS') {
    return conCabecerasSeguridad(new Response(null, { status: originApp ? 204 : 403 }), originApp)
  }

  const datos = ctx.data as Datos
  try {
    datos.ip = ipCliente(request)
    datos.sesion = await leerSesion(env, request)

    if (ESCRITURA.has(request.method)) {
      if (datos.sesion?.via === 'bearer') {
        // Sin CSRF posible: la credencial no viaja sola en peticiones cruzadas.
      } else if (originApp) {
        if (datos.sesion) throw new HttpError(403, 'Origen no permitido.', { codigo: 'origen' })
      } else {
        comprobarOrigen(request, env, url)
      }
      comprobarContentType(request)

      if (RUTAS_IA.has(url.pathname)) {
        await exigirLimite(env, await claveLimite('analizar:ip', datos.ip), 20, 60)
      }
      if (RUTAS_TURNSTILE.has(url.pathname)) {
        if (RUTAS_SESION_PREVIA.has(url.pathname) && !datos.sesion) {
          throw new HttpError(401, 'Necesitas iniciar sesión.')
        }
        const token = await extraerTokenTurnstile(request, url.pathname)
        if (!token) throw new HttpError(403, 'Falta la verificación anti-bots.', { codigo: 'turnstile_requerido' })
        if (!(await verificarTurnstile(env, token, datos.ip))) {
          throw new HttpError(403, 'La verificación anti-bots ha fallado. Recarga e inténtalo de nuevo.', { codigo: 'turnstile_invalido' })
        }
      }
    }

    const res = await ctx.next()
    ctx.waitUntil(limpiezaOportunista(env))
    return conCabecerasSeguridad(res, originApp)
  } catch (e) {
    return conCabecerasSeguridad(manejarError(e), originApp)
  }
}
