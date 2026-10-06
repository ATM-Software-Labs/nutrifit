/** POST /api/comidas/guardar — inserta una comida del usuario de la sesión. */
import type { Handler } from '../../utils/env.ts'
import { json } from '../../utils/response.ts'
import { leerBody } from '../../utils/http.ts'
import { comidaGuardarSchema } from '../../utils/schemas.ts'
import { exigirSesion } from '../../utils/session.ts'
import { exigirLimite } from '../../utils/rateLimit.ts'
import { aComidaApi, type FilaComida } from '../../utils/comidas.ts'

export const onRequestPost: Handler = async ({ request, env, data }) => {
  const sesion = exigirSesion(data.sesion)
  const c = await leerBody(request, comidaGuardarSchema, 64 * 1024)
  await exigirLimite(env, `guardar:u:${sesion.usuarioId}`, 300, 86400)

  const fila = await env.DB.prepare(
    `INSERT INTO diario_comidas
       (id, usuario_id, tipo_comida, descripcion, calorias, proteinas, carbohidratos, grasas, ingredientes_json, imagen_url, fecha)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
     RETURNING *`,
  )
    .bind(
      crypto.randomUUID(),
      sesion.usuarioId,
      c.tipo_comida,
      c.descripcion,
      c.calorias,
      c.proteinas,
      c.carbohidratos,
      c.grasas,
      c.ingredientes?.length ? JSON.stringify(c.ingredientes) : null,
      c.imagen_url ?? null,
      c.fecha,
    )
    .first<FilaComida>()

  return json({ ok: true, comida: fila ? aComidaApi(fila) : null }, { status: 201 })
}
