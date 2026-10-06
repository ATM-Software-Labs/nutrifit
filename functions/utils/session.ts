/**
 * Sesiones:
 *  · Web: cookie firmada (HMAC-SHA256), sin estado en servidor.
 *    nf_session · HttpOnly · Secure · SameSite=Strict · Path=/ · 30 días.
 *  · App Android: `Authorization: Bearer <token>` firmado con una clave
 *    derivada DISTINTA (propósito "app"), 60 días, revocable (tabla tokens_app).
 *    Una cookie no vale como Bearer ni al revés.
 */
import { esProduccion, type Env, type Sesion } from './env.ts'
import { base64urlEncode, bytesAleatorios, firmar, sha256Hex, verificarFirma } from './crypto.ts'
import { HttpError } from './response.ts'

export const COOKIE_SESION = 'nf_session'
export const DURACION_SESION = 30 * 24 * 3600

interface PayloadSesion {
  sub: string
  em: string
  iat: number
  exp: number
  v: 1
}

/** Secreto maestro; obligatorio y largo. En dev se permite uno fijo con aviso. */
export function authSecret(env: Env): string {
  const s = env.AUTH_SECRET?.trim()
  if (s && s.length >= 32) return s
  if (esProduccion(env)) {
    console.error('[auth] AUTH_SECRET ausente o < 32 caracteres en producción')
    throw new HttpError(500, 'Error de configuración del servidor.')
  }
  console.warn('[auth] AUTH_SECRET no configurado: usando secreto de DESARROLLO (inseguro)')
  return 'nutrifit-dev-only-secret-no-usar-en-produccion-000000'
}

export async function crearCookieSesion(env: Env, usuarioId: string, email: string): Promise<string> {
  const iat = Math.floor(Date.now() / 1000)
  const token = await firmar(authSecret(env), 'sesion', {
    sub: usuarioId,
    em: email,
    iat,
    exp: iat + DURACION_SESION,
    v: 1,
  } satisfies PayloadSesion)
  return `${COOKIE_SESION}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${DURACION_SESION}`
}

export const cookieBorrada = () => `${COOKIE_SESION}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`

export function leerCookie(request: Request, nombre: string): string | null {
  const cabecera = request.headers.get('Cookie')
  if (!cabecera) return null
  for (const parte of cabecera.split(';')) {
    const i = parte.indexOf('=')
    if (i > 0 && parte.slice(0, i).trim() === nombre) return parte.slice(i + 1).trim()
  }
  return null
}

// ------------------------------------------------------------ Bearer (app)
export const DURACION_TOKEN_APP = 60 * 24 * 3600

interface PayloadApp extends PayloadSesion {
  jti: string
  typ: 'app'
}

/** Emite un token Bearer para la app y lo registra (por hash) para poder revocarlo. */
export async function crearTokenApp(env: Env, usuarioId: string, email: string): Promise<{ token: string; exp: number }> {
  const iat = Math.floor(Date.now() / 1000)
  const exp = iat + DURACION_TOKEN_APP
  const jti = base64urlEncode(bytesAleatorios(18))
  await env.DB.prepare('INSERT INTO tokens_app (jti_hash, usuario_id, creado_en, expira_en) VALUES (?1, ?2, ?3, ?4)')
    .bind(await sha256Hex(jti), usuarioId, iat, exp)
    .run()
  const token = await firmar(authSecret(env), 'app', { sub: usuarioId, em: email, iat, exp, v: 1, jti, typ: 'app' } satisfies PayloadApp)
  return { token, exp }
}

/** Token de `Authorization: Bearer …` (null si no hay o el formato no cuadra). */
export function leerBearer(request: Request): string | null {
  const h = request.headers.get('Authorization')
  if (!h) return null
  const m = /^Bearer\s+([A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+)\s*$/.exec(h)
  return m ? m[1]! : null
}

/** Verifica firma, tipo, caducidad y que no esté revocado. */
export async function verificarTokenApp(env: Env, token: string): Promise<Sesion | null> {
  const p = await verificarFirma<PayloadApp>(authSecret(env), 'app', token)
  if (!p || p.v !== 1 || p.typ !== 'app' || typeof p.sub !== 'string' || typeof p.jti !== 'string' || typeof p.exp !== 'number') return null
  const ahora = Math.floor(Date.now() / 1000)
  if (p.exp <= ahora) return null
  const jtiHash = await sha256Hex(p.jti)
  const fila = await env.DB.prepare('SELECT 1 AS ok FROM tokens_app WHERE jti_hash = ?1 AND usuario_id = ?2 AND revocado_en IS NULL AND expira_en > ?3')
    .bind(jtiHash, p.sub, ahora)
    .first<{ ok: number }>()
  if (!fila) return null
  return { usuarioId: p.sub, email: p.em, exp: p.exp, via: 'bearer', jtiHash }
}

export async function revocarTokenApp(env: Env, jtiHash: string): Promise<void> {
  await env.DB.prepare('UPDATE tokens_app SET revocado_en = ?1 WHERE jti_hash = ?2 AND revocado_en IS NULL')
    .bind(Math.floor(Date.now() / 1000), jtiHash)
    .run()
}

/**
 * Sesión de la petición. Si llega `Authorization`, SOLO se usa el Bearer (sin
 * caer a la cookie): así una petición de la app nunca se autentica por cookie.
 */
export async function leerSesion(env: Env, request: Request): Promise<Sesion | null> {
  if (request.headers.has('Authorization')) {
    const bearer = leerBearer(request)
    return bearer ? verificarTokenApp(env, bearer) : null
  }
  const token = leerCookie(request, COOKIE_SESION)
  if (!token) return null
  const p = await verificarFirma<PayloadSesion>(authSecret(env), 'sesion', token)
  if (!p || p.v !== 1 || typeof p.sub !== 'string' || typeof p.exp !== 'number') return null
  if (p.exp <= Math.floor(Date.now() / 1000)) return null
  return { usuarioId: p.sub, email: p.em, exp: p.exp, via: 'cookie' }
}

/** Para handlers autenticados: devuelve la sesión o lanza 401. */
export function exigirSesion(sesion: Sesion | null): Sesion {
  if (!sesion) throw new HttpError(401, 'Necesitas iniciar sesión.')
  return sesion
}
