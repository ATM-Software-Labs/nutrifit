/**
 * GET  /api/alimentos/productos — productos propios del usuario.
 * POST /api/alimentos/productos — crea uno (o actualiza el del mismo código de barras).
 * Límite: 60 escrituras/hora por usuario; máx. 500 productos por usuario.
 */
import type { Handler } from '../../utils/env.ts'
import { error, json } from '../../utils/response.ts'
import { leerBody } from '../../utils/http.ts'
import { productoSchema } from '../../utils/schemas.ts'
import { exigirSesion } from '../../utils/session.ts'
import { exigirLimite } from '../../utils/rateLimit.ts'
import { guardarPropio, listarPropios } from '../../utils/productos.ts'

export const onRequestGet: Handler = async ({ env, data }) => {
  const sesion = exigirSesion(data.sesion)
  return json({ ok: true, productos: await listarPropios(env, sesion.usuarioId) })
}

export const onRequestPost: Handler = async ({ request, env, data }) => {
  const sesion = exigirSesion(data.sesion)
  const p = await leerBody(request, productoSchema)
  await exigirLimite(env, `productos:u:${sesion.usuarioId}`, 60, 3600, 'Demasiados productos guardados seguidos. Espera un poco.')
  const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM productos_usuario WHERE usuario_id = ?1').bind(sesion.usuarioId).first<{ n: number }>()
  if ((n?.n ?? 0) >= 500) return error(409, 'Has llegado al máximo de 500 productos propios. Borra alguno que ya no uses.')
  return json({ ok: true, producto: await guardarPropio(env, sesion.usuarioId, p) }, { status: 201 })
}
