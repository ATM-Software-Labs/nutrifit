import type { PagesFunction } from '@cloudflare/workers-types'

interface Env {
  DB: D1Database
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const url = new URL(request.url)
  const fecha = url.searchParams.get('fecha') || new Date().toISOString().slice(0, 10)

  try {
    const { results } = await env.DB.prepare(
      `SELECT id, tipo, nombre, minutos, calorias, origen, fecha 
       FROM entrenamientos 
       WHERE fecha = ? 
       ORDER BY creado_en DESC`
    ).bind(fecha).all()

    return Response.json({ entrenamientos: results })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  try {
    const b = await request.json() as {
      tipo: string
      nombre: string
      minutos: number
      calorias: number
      fecha?: string
      origen?: string
    }

    const id = crypto.randomUUID()
    const fecha = b.fecha || new Date().toISOString().slice(0, 10)
    const creadoEn = Date.now()

    await env.DB.prepare(
      `INSERT INTO entrenamientos (id, usuario_id, tipo, nombre, minutos, calorias, origen, fecha, creado_en)
       VALUES (?, 'default_user', ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, b.tipo, b.nombre, b.minutos, b.calorias, b.origen || 'manual', fecha, creadoEn).run()

    return Response.json({ ok: true, id })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
