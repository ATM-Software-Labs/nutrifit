/**
 * GET    /api/dispositivos — sesiones de ESTE usuario, si la tabla existe.
 * DELETE /api/dispositivos { sesionId } — solo una fila suya.
 * No basta con mandar una cabecera Authorization vacía de significado: la
 * sesión se contrasta con sesiones_web o tokens_app. Si la tabla no está,
 * se responde vacío o 404, sin devolver el SQL.
 */
import type { Handler } from '../../utils/env.ts'
import { error, json } from '../../utils/response.ts'
import { leerBody } from '../../utils/http.ts'
import { dispositivoSchema } from '../../utils/schemas.ts'
import { exigirIdentidad } from '../../utils/identidad.ts'

const COL = /^[A-Za-z_][A-Za-z0-9_]{0,40}$/

async function columnas(env: { DB: import('../../utils/env.ts').Env['DB'] }): Promise<string[] | null> {
  const tabla = await env.DB.prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'sesiones_dispositivos'").first<{ ok: number }>()
  if (!tabla) return null
  const info = await env.DB.prepare('PRAGMA table_info(sesiones_dispositivos)').all<{ name: string }>()
  return (info.results ?? []).map((c) => c.name).filter((c) => COL.test(c))
}

export const onRequestGet: Handler = async ({ env, data }) => {
  const sesion = await exigirIdentidad(env, data.sesion)
  try {
    const cols = await columnas(env)
    if (!cols?.includes('usuario_id') || !cols.includes('id')) return json({ ok: true, dispositivos: [] })
    const quiere = ['id', 'dispositivo', 'navegador', 'ip', 'ultimo_acceso'].filter((c) => cols.includes(c))
    const { results } = await env.DB.prepare(
      `SELECT ${quiere.join(', ')} FROM sesiones_dispositivos
       WHERE usuario_id = ?1 AND (revocado IS NULL OR revocado = 0)
       ORDER BY ultimo_acceso DESC LIMIT 50`,
    )
      .bind(sesion.usuarioId)
      .all()
    return json({ ok: true, dispositivos: results ?? [] })
  } catch {
    return json({ ok: true, dispositivos: [] })
  }
}

export const onRequestDelete: Handler = async ({ request, env, data }) => {
  const sesion = await exigirIdentidad(env, data.sesion)
  const { sesionId } = await leerBody(request, dispositivoSchema)
  try {
    const cols = await columnas(env)
    if (!cols?.includes('usuario_id') || !cols.includes('id') || !cols.includes('revocado')) return error(404, 'Sesión no encontrada.')
    const r = await env.DB.prepare('UPDATE sesiones_dispositivos SET revocado = 1 WHERE id = ?1 AND usuario_id = ?2')
      .bind(sesionId, sesion.usuarioId)
      .run()
    if (!r.meta.changes) return error(404, 'Sesión no encontrada.')
    return json({ ok: true })
  } catch {
    return error(404, 'Sesión no encontrada.')
  }
}
