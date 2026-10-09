/**
 * GET  /api/entrenamientos?fecha=YYYY-MM-DD — entrenos del usuario de la sesión.
 * POST /api/entrenamientos — el usuario_id sale de la sesión, nunca del JSON.
 * Acepta `minutos` (cliente actual) y `duracion_min`. Se guardan los dos.
 */
import type { Handler } from '../../utils/env.ts'
import { json } from '../../utils/response.ts'
import { leerBody, queryObj, validar } from '../../utils/http.ts'
import { entrenamientoSchema, entrenamientosQuery } from '../../utils/schemas.ts'
import { exigirIdentidad } from '../../utils/identidad.ts'
import { exigirLimite } from '../../utils/rateLimit.ts'
import { hoy } from '../../utils/fechas.ts'
import { presentarTexto } from '../../utils/sanitizar.ts'

interface FilaEntreno {
  id: string
  tipo: string
  nombre: string | null
  minutos: number | null
  duracion_min: number | null
  intensidad: string | null
  calorias: number | null
  origen: string | null
  fecha: string
}

function presentar(f: FilaEntreno) {
  const duracion = f.duracion_min ?? f.minutos
  return {
    id: f.id,
    tipo: f.tipo,
    nombre: presentarTexto(f.nombre),
    minutos: duracion,
    duracion_min: duracion,
    intensidad: f.intensidad,
    calorias: f.calorias ?? 0,
    origen: f.origen,
    fecha: f.fecha,
  }
}

export const onRequestGet: Handler = async ({ request, env, data }) => {
  const sesion = await exigirIdentidad(env, data.sesion)
  const q = validar(entrenamientosQuery, queryObj(request.url))
  if (q.recientes) {
    const { results } = await env.DB.prepare(
      `SELECT id, tipo, nombre, minutos, duracion_min, intensidad, calorias, origen, fecha
       FROM entrenamientos
       WHERE usuario_id = ?1
       ORDER BY fecha DESC, creado_en DESC
       LIMIT ?2`,
    )
      .bind(sesion.usuarioId, q.recientes)
      .all<FilaEntreno>()
    return json({ ok: true, fecha: q.fecha ?? hoy(), entrenamientos: (results ?? []).map(presentar) })
  }
  const fecha = q.fecha ?? hoy()
  const { results } = await env.DB.prepare(
    `SELECT id, tipo, nombre, minutos, duracion_min, intensidad, calorias, origen, fecha
     FROM entrenamientos
     WHERE usuario_id = ?1 AND fecha = ?2
     ORDER BY creado_en DESC`,
  )
    .bind(sesion.usuarioId, fecha)
    .all<FilaEntreno>()
  return json({ ok: true, fecha, entrenamientos: (results ?? []).map(presentar) })
}

export const onRequestPost: Handler = async ({ request, env, data }) => {
  const sesion = await exigirIdentidad(env, data.sesion)
  const b = await leerBody(request, entrenamientoSchema)
  await exigirLimite(env, `entreno:u:${sesion.usuarioId}`, 60, 3600, 'Has registrado demasiados entrenamientos. Espera un rato.')
  const duracion = b.duracion_min ?? b.minutos!
  const fecha = b.fecha ?? hoy()
  const id = crypto.randomUUID()
  await env.DB.prepare(
    `INSERT INTO entrenamientos
       (id, usuario_id, tipo, nombre, minutos, duracion_min, intensidad, calorias, origen, fecha, creado_en)
     VALUES (?1, ?2, ?3, ?4, ?5, ?5, ?6, ?7, ?8, ?9, datetime('now'))`,
  )
    .bind(id, sesion.usuarioId, b.tipo, b.nombre, duracion, b.intensidad ?? null, b.calorias, b.origen ?? 'manual', fecha)
    .run()
  return json({ ok: true, id, fecha }, { status: 201 })
}
