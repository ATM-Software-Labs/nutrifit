/**
 * POST /api/comidas/copiar — copia comidas de otro día (todo el día, unos tipos o
 * unas comidas concretas) a la fecha elegida. Solo del usuario de la sesión.
 */
import type { Handler } from '../../utils/env.ts'
import { json, error } from '../../utils/response.ts'
import { leerBody } from '../../utils/http.ts'
import { copiarComidasSchema } from '../../utils/schemas.ts'
import { exigirSesion } from '../../utils/session.ts'
import { exigirLimite } from '../../utils/rateLimit.ts'
import { aComidaApi } from '../../utils/comidas.ts'
import { copiarComidas } from '../../utils/copiarComidas.ts'

export const onRequestPost: Handler = async ({ request, env, data }) => {
  const sesion = exigirSesion(data.sesion)
  const b = await leerBody(request, copiarComidasSchema, 8 * 1024)
  await exigirLimite(env, `copiar:u:${sesion.usuarioId}`, 60, 86400)
  const filas = await copiarComidas(env, sesion.usuarioId, b.desde, b.hasta, b.ids, b.tipos)
  if (!filas.length) return error(404, 'No hay comidas que copiar en ese día.', { codigo: 'sin_comidas' })
  return json({ ok: true, copiadas: filas.length, comidas: filas.map(aComidaApi) }, { status: 201 })
}
