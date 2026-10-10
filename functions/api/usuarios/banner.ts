/** POST /api/usuarios/banner - JPEG, PNG o WebP, max 2 MB, id aleatorio. \n    DELETE /api/usuarios/banner - Borra el banner. */
import type { Handler } from '../../utils/env.ts'
import { json } from '../../utils/response.ts'
import { exigirIdentidad } from '../../utils/identidad.ts'
import { exigirLimite } from '../../utils/rateLimit.ts'
import { leerImagenSubida } from '../../utils/imagenSubida.ts'
import { asignarImagenPerfil, borrarArchivo } from '../../utils/archivos.ts'

export const onRequestPost: Handler = async ({ request, env, data }) => {
  const sesion = await exigirIdentidad(env, data.sesion)
  await exigirLimite(env, `banner:u:${sesion.usuarioId}`, 20, 3600, 'Demasiados cambios de foto. Espera un rato.')
  const imagen = await leerImagenSubida(request)
  const banner_url = await asignarImagenPerfil(env, sesion.usuarioId, 'banner', imagen)
  return json({ ok: true, banner_url })
}

export const onRequestDelete: Handler = async ({ env, data }) => {
  const sesion = await exigirIdentidad(env, data.sesion)
  const previo = await env.DB.prepare('SELECT banner_url FROM usuarios WHERE id = ?1').bind(sesion.usuarioId).first<{ banner_url: string | null }>()
  if (previo?.banner_url) {
    await env.DB.prepare('UPDATE usuarios SET banner_url = NULL, actualizado_en = CURRENT_TIMESTAMP WHERE id = ?1').bind(sesion.usuarioId).run()
    await borrarArchivo(env, sesion.usuarioId, previo.banner_url)
  }
  return json({ ok: true })
}
