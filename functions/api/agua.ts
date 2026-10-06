/**
 * POST /api/agua  { fecha, ml, modo: 'sumar'|'fijar' } — total del día (0..10 000 ml).
 * GET  /api/agua?fecha=YYYY-MM-DD
 */
import type { Handler } from '../utils/env.ts'
import { json } from '../utils/response.ts'
import { leerBody, queryObj, validar } from '../utils/http.ts'
import { aguaQuery, aguaSchema } from '../utils/schemas.ts'
import { exigirSesion } from '../utils/session.ts'

export const onRequestPost: Handler = async ({ request, env, data }) => {
  const sesion = exigirSesion(data.sesion)
  const { fecha, ml, modo } = await leerBody(request, aguaSchema)
  const fila = await env.DB.prepare(
    `INSERT INTO registro_agua (usuario_id, fecha, ml) VALUES (?1, ?2, max(0, min(10000, ?3)))
     ON CONFLICT (usuario_id, fecha) DO UPDATE SET
       ml = max(0, min(10000, CASE WHEN ?4 = 'sumar' THEN registro_agua.ml + ?3 ELSE ?3 END)),
       actualizado_en = CURRENT_TIMESTAMP
     RETURNING fecha, ml`,
  )
    .bind(sesion.usuarioId, fecha, ml, modo)
    .first<{ fecha: string; ml: number }>()
  return json({ ok: true, ...fila })
}

export const onRequestGet: Handler = async ({ request, env, data }) => {
  const sesion = exigirSesion(data.sesion)
  const { fecha } = validar(aguaQuery, queryObj(request.url))
  const fila = await env.DB.prepare('SELECT ml FROM registro_agua WHERE usuario_id = ?1 AND fecha = ?2')
    .bind(sesion.usuarioId, fecha)
    .first<{ ml: number }>()
  return json({ ok: true, fecha, ml: fila?.ml ?? 0 })
}
