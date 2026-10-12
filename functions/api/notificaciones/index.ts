/** GET /api/notificaciones — últimas 30 del centro de notificaciones. POST — marcar como leídas. */
import { z } from 'zod'
import type { Handler } from '../../utils/env.ts'
import { json } from '../../utils/response.ts'
import { exigirSesion } from '../../utils/session.ts'
import { validar } from '../../utils/http.ts'

export const onRequestGet: Handler = async ({ env, data }) => {
  const { usuarioId: id } = exigirSesion(data.sesion)
  const [lista, n] = await env.DB.batch([
    env.DB.prepare('SELECT id, tipo, titulo, cuerpo, url, leida, creado_en FROM notificaciones_app WHERE usuario_id = ?1 ORDER BY creado_en DESC LIMIT 30').bind(id),
    env.DB.prepare('SELECT COUNT(*) AS n FROM notificaciones_app WHERE usuario_id = ?1 AND leida = 0').bind(id),
  ])
  return json({ notificaciones: lista?.results ?? [], noLeidas: (n?.results?.[0] as { n: number } | undefined)?.n ?? 0 })
}

export const onRequestPost: Handler = async ({ request, env, data }) => {
  const { usuarioId: id } = exigirSesion(data.sesion)
  const { ids } = validar(z.object({ ids: z.array(z.string().max(40)).max(50).optional() }), await request.json())
  if (ids?.length) {
    await env.DB.batch(ids.map((x) => env.DB.prepare('UPDATE notificaciones_app SET leida = 1 WHERE id = ?1 AND usuario_id = ?2').bind(x, id)))
  } else {
    await env.DB.prepare('UPDATE notificaciones_app SET leida = 1 WHERE usuario_id = ?1 AND leida = 0').bind(id).run()
  }
  // Limpieza: más de 60 días.
  await env.DB.prepare("DELETE FROM notificaciones_app WHERE usuario_id = ?1 AND creado_en < datetime('now', '-60 days')").bind(id).run()
  return json({ ok: true })
}
