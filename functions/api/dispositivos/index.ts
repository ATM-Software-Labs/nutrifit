import type { PagesFunction } from '@cloudflare/workers-types'

interface Env {
  DB: D1Database
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const authHeader = request.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 })
  }

  try {
    const { results } = await env.DB.prepare(
      `SELECT id, dispositivo, navegador, ip, ultimo_acceso 
       FROM sesiones_dispositivos 
       WHERE revocado = 0 
       ORDER BY ultimo_acceso DESC`
    ).all()
    return Response.json({ dispositivos: results })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  try {
    const body = await request.json() as { sesionId?: string }
    if (!body?.sesionId) {
      return Response.json({ error: 'Falta sesionId' }, { status: 400 })
    }

    await env.DB.prepare(
      `UPDATE sesiones_dispositivos SET revocado = 1 WHERE id = ?`
    ).bind(body.sesionId).run()

    return Response.json({ ok: true })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
