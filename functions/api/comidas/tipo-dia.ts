/** PUT /api/comidas/tipo-dia — marca un día como entreno/descanso (o quita la marca). */
import type { Handler } from '../../utils/env.ts'
import { json } from '../../utils/response.ts'
import { leerBody } from '../../utils/http.ts'
import { tipoDiaSchema } from '../../utils/schemas.ts'
import { exigirSesion } from '../../utils/session.ts'
import { exigirLimite } from '../../utils/rateLimit.ts'

export const onRequestPut: Handler = async ({ request, env, data }) => {
  const sesion = exigirSesion(data.sesion)
  const b = await leerBody(request, tipoDiaSchema, 1024)
  await exigirLimite(env, `tipodia:u:${sesion.usuarioId}`, 200, 86400)
  if (b.tipo) {
    await env.DB.prepare('INSERT INTO tipo_dia (usuario_id, fecha, tipo) VALUES (?1, ?2, ?3) ON CONFLICT(usuario_id, fecha) DO UPDATE SET tipo = excluded.tipo')
      .bind(sesion.usuarioId, b.fecha, b.tipo)
      .run()
  } else {
    await env.DB.prepare('DELETE FROM tipo_dia WHERE usuario_id = ?1 AND fecha = ?2').bind(sesion.usuarioId, b.fecha).run()
  }
  return json({ ok: true, fecha: b.fecha, tipo: b.tipo })
}
