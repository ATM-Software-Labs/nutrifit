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
 *   1. Carga la sesión (cookie __Host-nf_session o Authorization: Bearer).
 *      Si el token de sesión tiene 12 h o más, se rota y se adjunta Set-Cookie.
 *   2. Login: 5 peticiones / 15 min por IP. Análisis de comidas: 20 / hora por
 *      usuario. Si el contador llega a 3× el máximo, la clave queda bloqueada 1 h.
 *   3. En escrituras (POST/PUT/PATCH/DELETE):
 *        · con Bearer válido no hay riesgo de CSRF (el navegador nunca añade esa
 *          cabecera por su cuenta) → se omite la comprobación de Origin;
 *        · desde el origen de la app sin Bearer solo se aceptan escrituras anónimas
 *          (pedir enlace, canjear token), nunca con cookie;
 *        · resto: Origin obligatorio y en la lista permitida (+ Sec-Fetch-Site ≠ cross-site);
 *        · Content-Type JSON o multipart (bloquea CSRF por formularios "simples");
 *        · bot score 1–29 en /api/auth y en la IA → 403 (si Cloudflare lo envía);
 *        · Turnstile (siteverify: secret, token, remoteip) obligatorio en RUTAS_TURNSTILE.
 *      El resto de escrituras autenticadas se apoyan en sesión + SameSite=Strict
 *      + comprobación de Origin (Turnstile sería impracticable en cada guardado).
 *   4. Manejo de errores genérico (sin filtrar detalles internos) y cabeceras
 *      OWASP ASVS en TODAS las respuestas de Functions (_headers no les aplica).
 */
import type { Datos, Env, Handler } from './utils/env.ts'
import { error, HttpError } from './utils/response.ts'
import { ipCliente, leerJson } from './utils/http.ts'
import { COOKIE_SESION, resolverSesion } from './utils/session.ts'
import { verificarTurnstile } from './utils/turnstile.ts'
import { puntuacionBot, scoreAnomalo } from './utils/bot.ts'
import { esErrorSql, formatearLog, hashIp, tiposDeEvento, type EventoLog } from './utils/log.ts'
import { guardarEventos } from './utils/turso.ts'
import { claveLimite, exigirLimite, limpiezaOportunista } from './utils/rateLimit.ts'
import { aplicarCabecerasAsvs, CSP_API } from './utils/cabeceras.ts'

const ESCRITURA = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/** Escrituras que exigen Turnstile (anónimas o caras). */
export const RUTAS_TURNSTILE = new Set([
  '/api/auth/solicitar',
  '/api/auth/codigo',
  '/api/usuarios/perfil',
  '/api/comidas/analizar',
  '/api/comidas/analizar-texto',
  '/api/alimentos/etiqueta',
])
/** Rutas con Turnstile que además requieren sesión: se comprueba ANTES de gastar el token. */
const RUTAS_SESION_PREVIA = new Set(['/api/usuarios/perfil', '/api/comidas/analizar', '/api/comidas/analizar-texto', '/api/alimentos/etiqueta'])
/** Foto y texto de una comida: 20 / hora por usuario (el tope diario sigue en el handler). */
const RUTAS_ANALISIS_COMIDA = new Set(['/api/comidas/analizar', '/api/comidas/analizar-texto'])
/** La etiqueta no es el análisis de comidas: se queda el tope corto por IP. */
const RUTA_ETIQUETA = '/api/alimentos/etiqueta'
/** Login (enlace, código, magic link y canje de la app). QR de emparejamiento no entra: hace polling. */
const RUTAS_LOGIN = new Set(['/api/auth/solicitar', '/api/auth/codigo', '/api/auth/verificar', '/api/auth/token'])

const MENSAJE_LOGIN = 'Demasiados intentos de acceso. Espera unos minutos antes de volver a intentarlo.'
const MENSAJE_BLOQUEO = 'Demasiados intentos seguidos. El acceso queda bloqueado un rato.'
const MENSAJE_ANALISIS = 'Has pedido demasiados análisis esta hora. Prueba más tarde o añade la comida a mano.'
const OPCIONES_PICO = { factorPico: 3, bloqueoSeg: 3600, mensajeBloqueo: MENSAJE_BLOQUEO }

/** Orígenes del WebView de Capacitor (APK). */
export const ORIGENES_APP = new Set(['https://localhost', 'capacitor://localhost'])

export function cabecerasCors(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, CF-Turnstile-Token, If-None-Match, If-Match, X-Sync-Prioridad',
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

function conCabecerasSeguridad(res: Response, originApp?: string | null, cookies: string[] = []): Response {
  const r = new Response(res.body, res) // copia mutable
  const h = r.headers
  if (originApp) for (const [k, v] of Object.entries(cabecerasCors(originApp))) h.set(k, v)
  else h.append('Vary', 'Origin')
  aplicarCabecerasAsvs(h, CSP_API)
  if (!h.has('cache-control')) h.set('Cache-Control', 'no-store')
  if (!respuestaBorraSesion(h)) for (const c of cookies) h.append('Set-Cookie', c)
  return r
}

/** Si el handler ya cierra la sesión, no volver a dejar la cookie rotada. */
function respuestaBorraSesion(h: Headers): boolean {
  const lista = typeof h.getSetCookie === 'function' ? h.getSetCookie() : []
  return lista.some((c) => /Max-Age=0/i.test(c) && (c.startsWith(`${COOKIE_SESION}=`) || c.startsWith('nf_session=')))
}

function manejarError(e: unknown): Response {
  if (e instanceof HttpError) return error(e.status, e.message, e.extra, e.headers)
  // Sin mensaje ni pila: un error de D1 puede repetir el SQL y, con él, un email.
  console.error('[api] error no controlado')
  return error(500, 'Error interno. Inténtalo de nuevo más tarde.')
}

function registrar(env: Env, request: Request, pathname: string, ip: string, status: number, inicio: number, sql: boolean) {
  const tipos = tiposDeEvento(pathname, status, sql)
  if (tipos.length === 0) return
  const latencia_ms = Date.now() - inicio
  const dia = new Date().toISOString().slice(0, 10)
  const timestamp = new Date().toISOString()
  return (async () => {
    try {
      const client_ip = await hashIp(env.AUTH_SECRET ?? '', ip, dia)
      const eventos: EventoLog[] = []
      for (const event_type of tipos) {
        const evento = { timestamp, client_ip, endpoint: pathname, method: request.method, latencia_ms, status_code: status, event_type }
        const linea = formatearLog(evento)
        console.log(linea)
        eventos.push(JSON.parse(linea) as EventoLog)
      }
      await guardarEventos(env, eventos)
    } catch {
      /* un fallo al escribir el log no cambia la respuesta */
    }
  })()
}

export const onRequest: Handler = async (ctx) => {
  const { request, env } = ctx
  const url = new URL(request.url)
  if (!url.pathname.startsWith('/api/')) {
    try {
      return conCabecerasSeguridad(await ctx.next())
    } catch (e) {
      return conCabecerasSeguridad(manejarError(e))
    }
  }

  const origin = request.headers.get('Origin')
  const originApp = origin && ORIGENES_APP.has(origin) ? origin : null

  // Preflight CORS: solo lo contestamos para la app; cualquier otro origen, 403.
  if (request.method === 'OPTIONS') {
    return conCabecerasSeguridad(new Response(null, { status: originApp ? 204 : 403 }), originApp)
  }

  const datos = ctx.data as Datos
  datos.cookiesRotacion = []
  const inicio = Date.now()
  try {
    datos.ip = ipCliente(request)
    const resuelta = await resolverSesion(env, request)
    datos.sesion = resuelta.sesion
    datos.cookiesRotacion = resuelta.cookies

    if ((url.pathname.startsWith('/api/auth/') || RUTAS_ANALISIS_COMIDA.has(url.pathname) || url.pathname === RUTA_ETIQUETA) && scoreAnomalo(puntuacionBot(request))) {
      throw new HttpError(403, 'No se ha podido verificar esta solicitud.', { codigo: 'score_anomalo' })
    }

    if (RUTAS_LOGIN.has(url.pathname)) {
      await exigirLimite(env, await claveLimite('login:ip', datos.ip), 5, 900, MENSAJE_LOGIN, OPCIONES_PICO)
    }

    if (ESCRITURA.has(request.method)) {
      if (datos.sesion?.via === 'bearer') {
        // Sin CSRF posible: la credencial no viaja sola en peticiones cruzadas.
      } else if (originApp) {
        if (datos.sesion) throw new HttpError(403, 'Origen no permitido.', { codigo: 'origen' })
      } else {
        comprobarOrigen(request, env, url)
      }
      comprobarContentType(request)

      if (url.pathname === RUTA_ETIQUETA) {
        await exigirLimite(env, await claveLimite('analizar:ip', datos.ip), 20, 60)
      }
      if (RUTAS_ANALISIS_COMIDA.has(url.pathname)) {
        if (!datos.sesion) throw new HttpError(401, 'Necesitas iniciar sesión.')
        await exigirLimite(env, `comida:hora:u:${datos.sesion.usuarioId}`, 20, 3600, MENSAJE_ANALISIS, OPCIONES_PICO)
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
    const log = registrar(env, request, url.pathname, datos.ip, res.status, inicio, false)
    ctx.waitUntil(Promise.all([limpiezaOportunista(env), log ?? Promise.resolve()]))
    return conCabecerasSeguridad(res, originApp, datos.cookiesRotacion)
  } catch (e) {
    const res = manejarError(e)
    const log = registrar(env, request, url.pathname, datos.ip ?? '', res.status, inicio, esErrorSql(e))
    if (log) ctx.waitUntil(log)
    return conCabecerasSeguridad(res, originApp, datos.cookiesRotacion)
  }
}
