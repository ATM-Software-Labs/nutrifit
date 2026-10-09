/** POST /api/comidas/foto — guarda la foto del plato y devuelve su ruta. No inserta el diario. */
import type { Handler } from '../../utils/env.ts'
import { json } from '../../utils/response.ts'
import { exigirIdentidad } from '../../utils/identidad.ts'
import { exigirLimite } from '../../utils/rateLimit.ts'
import { leerImagenSubida } from '../../utils/imagenSubida.ts'
import { guardarArchivo } from '../../utils/archivos.ts'

export const onRequestPost: Handler = async ({ request, env, data }) => {
  const sesion = await exigirIdentidad(env, data.sesion)
  await exigirLimite(env, `foto:u:${sesion.usuarioId}`, 40, 3600, 'Demasiadas fotos. Espera un rato.')
  const imagen = await leerImagenSubida(request)
  const { id, url } = await guardarArchivo(env, sesion.usuarioId, 'plato', imagen)
  return json({ ok: true, id, imagen_url: url }, { status: 201 })
}
