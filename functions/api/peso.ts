/**
 * POST /api/peso  { peso, fecha? }  — registra (o corrige) el peso del día.
 * GET  /api/peso?dias=30            — histórico de los últimos N días.
 */
import type { Handler } from '../utils/env.ts'
import { json } from '../utils/response.ts'
import { leerBody, queryObj, validar } from '../utils/http.ts'
import { pesoQuery, pesoSchema } from '../utils/schemas.ts'
import { exigirSesion } from '../utils/session.ts'
import { hoy } from '../utils/fechas.ts'
import { conEtag, hashContenido, hashEnviado, noModificado } from '../utils/contenidoHash.ts'
import { dentroDeVentana, esPrioridadAlta } from '../utils/ventanaSync.ts'
import { aplazarHistoricoPeso, hayPesoPosterior, listarPesos, pesoDelDia, tursoConfigurado } from '../utils/turso.ts'

export const onRequestPost: Handler = async (ctx) => {
  const { request, env, data } = ctx
  const sesion = exigirSesion(data.sesion)
  const { peso, fecha = hoy() } = await leerBody(request, pesoSchema)
  if (!esPrioridadAlta(request) && !(await dentroDeVentana(sesion.usuarioId))) {
    return json({ ok: true, aplazado: true, registro: { fecha, peso } }, { status: 202 })
  }
  const hash = await hashContenido({ fecha, peso })
  const actual = await pesoDelDia(env, sesion.usuarioId, fecha)
  if (actual != null && actual === peso) {
    if (hashEnviado(request) === hash) return noModificado(hash)
    return json({ ok: true, registro: { fecha, peso } }, { headers: conEtag(hash) })
  }
  if (tursoConfigurado(env)) {
    if (!(await hayPesoPosterior(env, sesion.usuarioId, fecha))) {
      await env.DB.prepare('UPDATE usuarios SET peso_kg = ?1, actualizado_en = CURRENT_TIMESTAMP WHERE id = ?2').bind(peso, sesion.usuarioId).run()
    }
    aplazarHistoricoPeso(ctx, { id: crypto.randomUUID(), usuarioId: sesion.usuarioId, peso, fecha })
    return json({ ok: true, registro: { fecha, peso } }, { status: 201, headers: conEtag(hash) })
  }
  const [reg] = await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO historico_peso (id, usuario_id, peso, fecha) VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT (usuario_id, fecha) DO UPDATE SET peso = excluded.peso
       WHERE historico_peso.peso IS NOT excluded.peso
       RETURNING fecha, peso`,
    ).bind(crypto.randomUUID(), sesion.usuarioId, peso, fecha),
    // El peso del perfil se actualiza solo si este es el registro más reciente.
    env.DB.prepare(
      `UPDATE usuarios SET peso_kg = ?1, actualizado_en = CURRENT_TIMESTAMP
        WHERE id = ?2 AND NOT EXISTS (SELECT 1 FROM historico_peso WHERE usuario_id = ?2 AND fecha > ?3)`,
    ).bind(peso, sesion.usuarioId, fecha),
  ])
  return json({ ok: true, registro: reg?.results?.[0] ?? { fecha, peso } }, { status: 201, headers: conEtag(hash) })
}

export const onRequestGet: Handler = async ({ request, env, data }) => {
  const sesion = exigirSesion(data.sesion)
  const { dias } = validar(pesoQuery, queryObj(request.url))
  const desde = hoy(undefined, new Date(Date.now() - dias * 86400_000))
  const registros = await listarPesos(env, sesion.usuarioId, desde)
  return json({ ok: true, dias, registros })
}
