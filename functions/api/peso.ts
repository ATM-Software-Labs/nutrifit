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

export const onRequestPost: Handler = async ({ request, env, data }) => {
  const sesion = exigirSesion(data.sesion)
  const { peso, fecha = hoy() } = await leerBody(request, pesoSchema)
  const [reg] = await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO historico_peso (id, usuario_id, peso, fecha) VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT (usuario_id, fecha) DO UPDATE SET peso = excluded.peso
       RETURNING fecha, peso`,
    ).bind(crypto.randomUUID(), sesion.usuarioId, peso, fecha),
    // El peso del perfil se actualiza solo si este es el registro más reciente.
    env.DB.prepare(
      `UPDATE usuarios SET peso_kg = ?1, actualizado_en = CURRENT_TIMESTAMP
        WHERE id = ?2 AND NOT EXISTS (SELECT 1 FROM historico_peso WHERE usuario_id = ?2 AND fecha > ?3)`,
    ).bind(peso, sesion.usuarioId, fecha),
  ])
  return json({ ok: true, registro: reg?.results?.[0] ?? null }, { status: 201 })
}

export const onRequestGet: Handler = async ({ request, env, data }) => {
  const sesion = exigirSesion(data.sesion)
  const { dias } = validar(pesoQuery, queryObj(request.url))
  const desde = hoy(undefined, new Date(Date.now() - dias * 86400_000))
  const { results } = await env.DB.prepare(
    'SELECT fecha, peso FROM historico_peso WHERE usuario_id = ?1 AND fecha >= ?2 ORDER BY fecha',
  )
    .bind(sesion.usuarioId, desde)
    .all<{ fecha: string; peso: number }>()
  return json({ ok: true, dias, registros: results })
}
