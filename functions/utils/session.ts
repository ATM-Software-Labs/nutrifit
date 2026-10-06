/**
 * Sesión en cookie firmada (HMAC-SHA256), sin estado en servidor.
 * Cookie: nf_session  · HttpOnly · Secure · SameSite=Strict · Path=/ · 30 días.
 */
import { esProduccion, type Env, type Sesion } from './env.ts'
import { firmar, verificarFirma } from './crypto.ts'
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

/** Devuelve la sesión si la cookie es auténtica y no ha caducado. */
export async function leerSesion(env: Env, request: Request): Promise<Sesion | null> {
  const token = leerCookie(request, COOKIE_SESION)
  if (!token) return null
  const p = await verificarFirma<PayloadSesion>(authSecret(env), 'sesion', token)
  if (!p || p.v !== 1 || typeof p.sub !== 'string' || typeof p.exp !== 'number') return null
  if (p.exp <= Math.floor(Date.now() / 1000)) return null
  return { usuarioId: p.sub, email: p.em, exp: p.exp }
}

/** Para handlers autenticados: devuelve la sesión o lanza 401. */
export function exigirSesion(sesion: Sesion | null): Sesion {
  if (!sesion) throw new HttpError(401, 'Necesitas iniciar sesión.')
  return sesion
}
