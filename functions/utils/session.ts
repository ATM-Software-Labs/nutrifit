/**
 * Sesiones:
 *  · Web: cookie `__Host-nf_session` (HMAC-SHA256, propósito "sesion").
 *    HttpOnly · Secure · SameSite=Strict · Path=/ · sin Domain (prefijo __Host-,
 *    anti-fijación / cookie tossing). El sid vive en D1 solo como hash: cada
 *    login crea una familia nueva (no se reutiliza un id del cliente) y el
 *    token se rota solo a las 12 h. Reusar un sid ya rotado, fuera de la gracia,
 *    revoca la familia entera.
 *  · App Android: `Authorization: Bearer <token>` firmado con una clave
 *    derivada DISTINTA (propósito "app"), 60 días, revocable (tabla tokens_app).
 *    Una cookie no vale como Bearer ni al revés.
 */
import { esProduccion, type Env, type Sesion } from './env.ts'
import { base64urlEncode, bytesAleatorios, firmar, sha256Hex, verificarFirma } from './crypto.ts'
import { HttpError } from './response.ts'

/** Prefijo __Host-: el navegador exige Secure, Path=/ y prohíbe Domain. */
export const COOKIE_SESION = '__Host-nf_session'
/** Cookie anterior, sin prefijo. Solo se borra; ya no se acepta. */
const COOKIE_LEGACY = 'nf_session'
export const DURACION_SESION = 30 * 24 * 3600
/** Rotación automática del token firmado. */
export const ROTACION_SESION = 12 * 3600
/** Ventana en la que el sid anterior sigue valiendo (pestañas en paralelo). */
export const GRACIA_ROTACION = 120

interface PayloadSesion {
  sub: string
  em: string
  iat: number
  exp: number
  v: 2
  sid: string
  fam: string
}

interface FilaSesion {
  usuario_id: string
  email: string
  expira_en: number
  revocado_en: number | null
  reemplazado_por: string | null
  gracia_hasta: number | null
  familia_hash: string
  visto_en: number | null
}

const ATRIBUTOS = 'HttpOnly; Secure; SameSite=Strict; Path=/'

function cookieCon(token: string, maxAge: number): string {
  return `${COOKIE_SESION}=${token}; ${ATRIBUTOS}; Max-Age=${maxAge}`
}

export function cookiesBorrado(): string[] {
  return [`${COOKIE_SESION}=; ${ATRIBUTOS}; Max-Age=0`, `${COOKIE_LEGACY}=; ${ATRIBUTOS}; Max-Age=0`]
}

export function cabeceraSetCookies(cookies: string[]): Headers {
  const h = new Headers()
  for (const c of cookies) h.append('Set-Cookie', c)
  return h
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

export async function crearCookieSesion(env: Env, usuarioId: string, email: string, ahora = Math.floor(Date.now() / 1000)): Promise<string> {
  const sid = base64urlEncode(bytesAleatorios(32))
  const fam = base64urlEncode(bytesAleatorios(32))
  const sidHash = await sha256Hex(sid)
  const familiaHash = await sha256Hex(fam)
  const exp = ahora + DURACION_SESION
  await env.DB.prepare(
    'INSERT INTO sesiones_web (sid_hash, familia_hash, usuario_id, email, creado_en, expira_en) VALUES (?1, ?2, ?3, ?4, ?5, ?6)',
  )
    .bind(sidHash, familiaHash, usuarioId, email, ahora, exp)
    .run()
  const token = await firmar(authSecret(env), 'sesion', {
    sub: usuarioId,
    em: email,
    iat: ahora,
    exp,
    v: 2,
    sid,
    fam,
  } satisfies PayloadSesion)
  return cookieCon(token, DURACION_SESION)
}

export function leerCookie(request: Request, nombre: string): string | null {
  const cabecera = request.headers.get('Cookie')
  if (!cabecera) return null
  for (const parte of cabecera.split(';')) {
    const i = parte.indexOf('=')
    if (i > 0 && parte.slice(0, i).trim() === nombre) return parte.slice(i + 1).trim()
  }
  return null
}

async function filaSesion(env: Env, sidHash: string): Promise<FilaSesion | null> {
  return env.DB.prepare(
    `SELECT usuario_id, email, expira_en, revocado_en, reemplazado_por, gracia_hasta, familia_hash, visto_en
     FROM sesiones_web WHERE sid_hash = ?1`,
  )
    .bind(sidHash)
    .first<FilaSesion>()
}

export async function revocarFamiliaWeb(env: Env, familiaHash: string): Promise<void> {
  await env.DB.prepare('UPDATE sesiones_web SET revocado_en = ?1 WHERE familia_hash = ?2 AND revocado_en IS NULL')
    .bind(Math.floor(Date.now() / 1000), familiaHash)
    .run()
}

interface RespuestaSesion {
  sesion: Sesion | null
  cookies: string[]
}

const vacia: RespuestaSesion = { sesion: null, cookies: [] }

function sesionDe(p: PayloadSesion, fila: FilaSesion, sidHash: string): Sesion {
  return {
    usuarioId: fila.usuario_id,
    email: typeof p.em === 'string' ? p.em : fila.email,
    exp: fila.expira_en,
    via: 'cookie',
    sidHash,
    familiaHash: fila.familia_hash,
  }
}

async function rotar(env: Env, p: PayloadSesion, fila: FilaSesion, sidHashViejo: string, ahora: number): Promise<RespuestaSesion | null> {
  const sid = base64urlEncode(bytesAleatorios(32))
  const sidHash = await sha256Hex(sid)
  const exp = ahora + DURACION_SESION
  const gracia = ahora + GRACIA_ROTACION
  const claim = await env.DB.prepare(
    `UPDATE sesiones_web SET reemplazado_por = ?1, gracia_hasta = ?2
     WHERE sid_hash = ?3 AND reemplazado_por IS NULL AND revocado_en IS NULL`,
  )
    .bind(sidHash, gracia, sidHashViejo)
    .run()
  if ((claim.meta?.changes ?? 0) < 1) return null
  try {
    await env.DB.prepare(
      'INSERT INTO sesiones_web (sid_hash, familia_hash, usuario_id, email, creado_en, expira_en) VALUES (?1, ?2, ?3, ?4, ?5, ?6)',
    )
      .bind(sidHash, fila.familia_hash, fila.usuario_id, fila.email, ahora, exp)
      .run()
  } catch (e) {
    await env.DB.prepare('UPDATE sesiones_web SET reemplazado_por = NULL, gracia_hasta = NULL WHERE sid_hash = ?1 AND reemplazado_por = ?2')
      .bind(sidHashViejo, sidHash)
      .run()
    throw e
  }
  const token = await firmar(authSecret(env), 'sesion', {
    sub: fila.usuario_id,
    em: fila.email,
    iat: ahora,
    exp,
    v: 2,
    sid,
    fam: p.fam,
  } satisfies PayloadSesion)
  const sesion = sesionDe({ ...p, em: fila.email, exp, iat: ahora }, { ...fila, expira_en: exp, email: fila.email }, sidHash)
  return { sesion, cookies: [cookieCon(token, DURACION_SESION)] }
}

async function resolverCookie(env: Env, token: string): Promise<RespuestaSesion> {
  const p = await verificarFirma<PayloadSesion>(authSecret(env), 'sesion', token)
  if (!p || p.v !== 2 || typeof p.sub !== 'string' || typeof p.sid !== 'string' || typeof p.fam !== 'string' || typeof p.exp !== 'number' || typeof p.iat !== 'number') {
    return vacia
  }
  const ahora = Math.floor(Date.now() / 1000)
  if (p.exp <= ahora) return vacia
  const sidHash = await sha256Hex(p.sid)
  const fila = await filaSesion(env, sidHash)
  if (!fila || fila.revocado_en || fila.usuario_id !== p.sub || fila.expira_en <= ahora) return vacia
  if ((await sha256Hex(p.fam)) !== fila.familia_hash) return vacia

  if (fila.reemplazado_por) {
    if (fila.gracia_hasta != null && fila.gracia_hasta >= ahora) return { sesion: sesionDe(p, fila, sidHash), cookies: [] }
    const sucesor = await filaSesion(env, fila.reemplazado_por)
    // El sid nuevo ya se usó y alguien presenta el viejo fuera de la gracia: sesión robada.
    if (sucesor?.visto_en) {
      await revocarFamiliaWeb(env, fila.familia_hash)
      return vacia
    }
    // La cookie nueva no llegó al navegador: se deshace y se emite otra.
    await env.DB.prepare('DELETE FROM sesiones_web WHERE sid_hash = ?1 AND visto_en IS NULL').bind(fila.reemplazado_por).run()
    await env.DB.prepare('UPDATE sesiones_web SET reemplazado_por = NULL, gracia_hasta = NULL WHERE sid_hash = ?1 AND reemplazado_por = ?2')
      .bind(sidHash, fila.reemplazado_por)
      .run()
    const limpia = await filaSesion(env, sidHash)
    if (!limpia || limpia.revocado_en || limpia.reemplazado_por) return vacia
    const reemitida = await rotar(env, p, limpia, sidHash, ahora)
    if (reemitida) return reemitida
    return { sesion: sesionDe(p, limpia, sidHash), cookies: [] }
  }

  if (ahora - p.iat >= ROTACION_SESION) {
    const nueva = await rotar(env, p, fila, sidHash, ahora)
    if (nueva) return nueva
    const otra = await filaSesion(env, sidHash)
    if (otra && !otra.revocado_en && otra.gracia_hasta != null && otra.gracia_hasta >= ahora) {
      return { sesion: sesionDe(p, otra, sidHash), cookies: [] }
    }
    if (otra?.reemplazado_por) return resolverCookie(env, token)
    return vacia
  }

  if (fila.visto_en == null) {
    await env.DB.prepare('UPDATE sesiones_web SET visto_en = ?1 WHERE sid_hash = ?2 AND visto_en IS NULL').bind(ahora, sidHash).run()
  }
  return { sesion: sesionDe(p, fila, sidHash), cookies: [] }
}

/**
 * Sesión de la petición y, si tocó rotar, la cookie nueva.
 * Si llega `Authorization`, SOLO se usa el Bearer (sin caer a la cookie).
 */
export async function resolverSesion(env: Env, request: Request): Promise<RespuestaSesion> {
  if (request.headers.has('Authorization')) {
    const bearer = leerBearer(request)
    const sesion = bearer ? await verificarTokenApp(env, bearer) : null
    return { sesion, cookies: [] }
  }
  const token = leerCookie(request, COOKIE_SESION)
  if (!token) return vacia
  return resolverCookie(env, token)
}

export async function leerSesion(env: Env, request: Request): Promise<Sesion | null> {
  return (await resolverSesion(env, request)).sesion
}

/** Para handlers autenticados: devuelve la sesión o lanza 401. */
export function exigirSesion(sesion: Sesion | null): Sesion {
  if (!sesion) throw new HttpError(401, 'Necesitas iniciar sesión.')
  return sesion
}

// ------------------------------------------------------------ Bearer (app)
export const DURACION_TOKEN_APP = 60 * 24 * 3600

interface PayloadApp {
  sub: string
  em: string
  iat: number
  exp: number
  v: 1
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
