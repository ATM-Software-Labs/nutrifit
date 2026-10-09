/**
 * La sesión que deja el middleware se vuelve a contrastar con la fila de
 * sesiones_web (cookie) o tokens_app (Android) y con usuarios. El id de la
 * petición es el de esa fila: un usuario_id del JSON no se lee.
 */
import type { Env, Sesion } from './env.ts'
import { HttpError } from './response.ts'
import { exigirSesion } from './session.ts'

export async function exigirIdentidad(env: Env, sesion: Sesion | null): Promise<Sesion> {
  const s = exigirSesion(sesion)
  const ahora = Math.floor(Date.now() / 1000)
  const usuario = await env.DB.prepare('SELECT id FROM usuarios WHERE id = ?1').bind(s.usuarioId).first<{ id: string }>()
  if (!usuario) throw new HttpError(401, 'Necesitas iniciar sesión.')

  if (s.via === 'cookie') {
    if (!s.sidHash) throw new HttpError(401, 'Necesitas iniciar sesión.')
    const fila = await env.DB.prepare(
      `SELECT usuario_id FROM sesiones_web
       WHERE sid_hash = ?1 AND usuario_id = ?2 AND revocado_en IS NULL AND expira_en > ?3`,
    )
      .bind(s.sidHash, s.usuarioId, ahora)
      .first<{ usuario_id: string }>()
    if (!fila) throw new HttpError(401, 'Necesitas iniciar sesión.')
    return s
  }

  if (!s.jtiHash) throw new HttpError(401, 'Necesitas iniciar sesión.')
  const token = await env.DB.prepare(
    `SELECT usuario_id FROM tokens_app
     WHERE jti_hash = ?1 AND usuario_id = ?2 AND revocado_en IS NULL AND expira_en > ?3`,
  )
    .bind(s.jtiHash, s.usuarioId, ahora)
    .first<{ usuario_id: string }>()
  if (!token) throw new HttpError(401, 'Necesitas iniciar sesión.')
  return s
}

/** Para handlers antiguos tipados como PagesFunction: la sesión vive en context.data. */
export function exigirDesdeContexto(env: unknown, data: unknown): Promise<Sesion> {
  const sesion = data && typeof data === 'object' && 'sesion' in data ? (data as { sesion: Sesion | null }).sesion : null
  return exigirIdentidad(env as Env, sesion)
}
