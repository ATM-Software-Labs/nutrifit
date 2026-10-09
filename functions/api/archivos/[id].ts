/**
 * GET /api/archivos/:id
 * El plato solo lo ve su dueño. Avatar y banner de un perfil público se
 * pueden leer sin sesión (el id es un UUID impredecible). El resto, 404.
 */
import type { Handler } from '../../utils/env.ts'
import { error } from '../../utils/response.ts'
import { idRuta } from '../../utils/http.ts'
import { exigirIdentidad } from '../../utils/identidad.ts'
import { aBytes } from '../../utils/archivos.ts'
import { HttpError } from '../../utils/response.ts'

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

export const onRequestGet: Handler<'id'> = async ({ env, data, params }) => {
  const id = idRuta(params.id)
  const fila = await env.DB.prepare('SELECT usuario_id, clase, mime, contenido FROM archivos_usuario WHERE id = ?1')
    .bind(id)
    .first<{ usuario_id: string; clase: string; mime: string; contenido: unknown }>()
  if (!fila || !EXT[fila.mime]) return error(404, 'Archivo no encontrado.')

  const propio = data.sesion?.usuarioId === fila.usuario_id
  if (propio) {
    await exigirIdentidad(env, data.sesion)
  } else if (fila.clase === 'plato') {
    return error(404, 'Archivo no encontrado.')
  } else {
    const pub = await env.DB.prepare('SELECT es_publico FROM usuarios WHERE id = ?1').bind(fila.usuario_id).first<{ es_publico: number }>()
    if (!pub || pub.es_publico !== 1) {
      if (!data.sesion) return error(404, 'Archivo no encontrado.')
      await exigirIdentidad(env, data.sesion)
      return error(404, 'Archivo no encontrado.')
    }
  }

  const bytes = aBytes(fila.contenido)
  if (!bytes) throw new HttpError(404, 'Archivo no encontrado.')
  return new Response(bytes, {
    headers: {
      'content-type': fila.mime,
      'content-disposition': `inline; filename="${id}.${EXT[fila.mime]}"`,
      'cache-control': 'private, max-age=300',
      'x-content-type-options': 'nosniff',
    },
  })
}
