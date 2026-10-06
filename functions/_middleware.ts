/**
 * Middleware global de NutriFit (se ejecuta antes de cada Function).
 * public/_routes.json limita la invocación de Functions a /api/*, así que los
 * estáticos no pasan por aquí (ni consumen peticiones de Workers).
 *
 * Para /api/*:
 *   1. Carga la sesión (cookie nf_session firmada) en context.data.sesion.
 *   2. En escrituras (POST/PUT/PATCH/DELETE):
 *        · Origin obligatorio y en la lista permitida (+ Sec-Fetch-Site ≠ cross-site);
 *        · Content-Type JSON o multipart (bloquea CSRF por formularios "simples");
 *        · rate limit 20/min por IP en /api/comidas/analizar;
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
export const RUTAS_TURNSTILE = new Set(['/api/auth/solicitar', '/api/usuarios/perfil', '/api/comidas/analizar'])
/** Rutas con Turnstile que además requieren sesión: se comprueba ANTES de gastar el token. */
const RUTAS_SESION_PREVIA = new Set(['/api/usuarios/perfil', '/api/comidas/analizar'])

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
      const max = pathname === '/api/comidas/analizar' ? MAX_JSON_ANALIZAR : undefined
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

function conCabecerasSeguridad(res: Response): Response {
  const r = new Response(res.body, res) // copia mutable
  const h = r.headers
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

  const datos = ctx.data as Datos
  try {
    datos.ip = ipCliente(request)
    datos.sesion = await leerSesion(env, request)

    if (ESCRITURA.has(request.method)) {
      comprobarOrigen(request, env, url)
      comprobarContentType(request)

      if (url.pathname === '/api/comidas/analizar') {
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
    return conCabecerasSeguridad(res)
  } catch (e) {
    return conCabecerasSeguridad(manejarError(e))
  }
}
