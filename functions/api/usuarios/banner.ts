/** POST /api/usuarios/banner — JPEG, PNG o WebP, máximo 2 MB, id aleatorio. */
import type { Handler } from '../../utils/env.ts'
import { json } from '../../utils/response.ts'
import { exigirIdentidad } from '../../utils/identidad.ts'
import { exigirLimite } from '../../utils/rateLimit.ts'
import { leerImagenSubida } from '../../utils/imagenSubida.ts'
import { asignarImagenPerfil } from '../../utils/archivos.ts'

export const onRequestPost: Handler = async ({ request, env, data }) => {
  const sesion = await exigirIdentidad(env, data.sesion)
  await exigirLimite(env, `banner:u:${sesion.usuarioId}`, 20, 3600, 'Demasiados cambios de foto. Espera un rato.')
  const imagen = await leerImagenSubida(request)
  const banner_url = await asignarImagenPerfil(env, sesion.usuarioId, 'banner', imagen)
  return json({ ok: true, banner_url })
}
