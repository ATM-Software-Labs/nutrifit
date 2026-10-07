/**
 * POST /api/agua  { fecha, ml, modo: 'sumar'|'fijar' } — total del día (0..10 000 ml).
 * GET  /api/agua?fecha=YYYY-MM-DD
 */
import type { Handler } from '../utils/env.ts'
import { json } from '../utils/response.ts'
import { leerBody, queryObj, validar } from '../utils/http.ts'
import { aguaQuery, aguaSchema } from '../utils/schemas.ts'
import { exigirSesion } from '../utils/session.ts'
import { conEtag, hashContenido, hashEnviado, noModificado } from '../utils/contenidoHash.ts'
import { dentroDeVentana, esPrioridadAlta } from '../utils/ventanaSync.ts'

const acotar = (n: number) => Math.max(0, Math.min(10000, Math.round(n)))

export const onRequestPost: Handler = async ({ request, env, data }) => {
  const sesion = exigirSesion(data.sesion)
  const { fecha, ml, modo } = await leerBody(request, aguaSchema)
  if (!esPrioridadAlta(request) && !(await dentroDeVentana(sesion.usuarioId))) {
    return json({ ok: true, aplazado: true, fecha, ml }, { status: 202 })
  }
  const actual = await env.DB.prepare('SELECT ml FROM registro_agua WHERE usuario_id = ?1 AND fecha = ?2')
    .bind(sesion.usuarioId, fecha)
    .first<{ ml: number }>()
  const siguiente = acotar(modo === 'sumar' ? (actual?.ml ?? 0) + ml : ml)
  const hash = await hashContenido({ fecha, ml: siguiente })
  if (actual && actual.ml === siguiente) {
    if (hashEnviado(request) === hash) return noModificado(hash)
    return json({ ok: true, fecha, ml: actual.ml }, { headers: conEtag(hash) })
  }
  const fila = await env.DB.prepare(
    `INSERT INTO registro_agua (usuario_id, fecha, ml) VALUES (?1, ?2, max(0, min(10000, ?3)))
     ON CONFLICT (usuario_id, fecha) DO UPDATE SET
       ml = max(0, min(10000, CASE WHEN ?4 = 'sumar' THEN registro_agua.ml + ?3 ELSE ?3 END)),
       actualizado_en = CURRENT_TIMESTAMP
     RETURNING fecha, ml`,
  )
    .bind(sesion.usuarioId, fecha, ml, modo)
    .first<{ fecha: string; ml: number }>()
  const guardado = fila?.ml ?? siguiente
  const etag = guardado === siguiente ? hash : await hashContenido({ fecha, ml: guardado })
  return json({ ok: true, ...fila }, { headers: conEtag(etag) })
}

export const onRequestGet: Handler = async ({ request, env, data }) => {
  const sesion = exigirSesion(data.sesion)
  const { fecha } = validar(aguaQuery, queryObj(request.url))
  const fila = await env.DB.prepare('SELECT ml FROM registro_agua WHERE usuario_id = ?1 AND fecha = ?2')
    .bind(sesion.usuarioId, fecha)
    .first<{ ml: number }>()
  return json({ ok: true, fecha, ml: fila?.ml ?? 0 })
}
