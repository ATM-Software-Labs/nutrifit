/**
 * PUT    /api/alimentos/productos/:id — edita un producto propio.
 * DELETE /api/alimentos/productos/:id — lo borra.
 * "No existe" y "no es tuyo" devuelven el mismo 404.
 */
import type { Handler } from '../../../utils/env.ts'
import { error, json } from '../../../utils/response.ts'
import { leerBody, validar } from '../../../utils/http.ts'
import { productoSchema, uuid } from '../../../utils/schemas.ts'
import { exigirSesion } from '../../../utils/session.ts'
import { exigirLimite } from '../../../utils/rateLimit.ts'
import { actualizarPropio } from '../../../utils/productos.ts'

const idDe = (p: string | string[] | undefined) => validar(uuid, Array.isArray(p) ? p[0] : p)

export const onRequestPut: Handler<'id'> = async ({ request, env, data, params }) => {
  const sesion = exigirSesion(data.sesion)
  const id = idDe(params.id)
  const p = await leerBody(request, productoSchema)
  await exigirLimite(env, `productos:u:${sesion.usuarioId}`, 60, 3600, 'Demasiados cambios seguidos. Espera un poco.')
  try {
    const producto = await actualizarPropio(env, sesion.usuarioId, id, p)
    return producto ? json({ ok: true, producto }) : error(404, 'Producto no encontrado.')
  } catch (e) {
    if (e instanceof Error && /UNIQUE/i.test(e.message)) return error(409, 'Ya tienes otro producto con ese código de barras.')
    throw e
  }
}

export const onRequestDelete: Handler<'id'> = async ({ env, data, params }) => {
  const sesion = exigirSesion(data.sesion)
  const id = idDe(params.id)
  const r = await env.DB.prepare('DELETE FROM productos_usuario WHERE id = ?1 AND usuario_id = ?2').bind(id, sesion.usuarioId).run()
  if (!r.meta.changes) return error(404, 'Producto no encontrado.')
  return json({ ok: true, id })
}
