/** GET /api/compartir/dia?fecha=YYYY-MM-DD — datos de la tarjeta (solo del usuario de la sesión). */
import type { Handler } from '../../utils/env.ts'
import { json } from '../../utils/response.ts'
import { queryObj, validar } from '../../utils/http.ts'
import { resumenQuery } from '../../utils/schemas.ts'
import { exigirSesion } from '../../utils/session.ts'
import { hoy } from '../../utils/fechas.ts'
import { leerDiaCompartible } from '../../utils/compartirDb.ts'

export const onRequestGet: Handler = async ({ request, env, data }) => {
  const sesion = exigirSesion(data.sesion)
  const { fecha } = validar(resumenQuery, { fecha: queryObj(request.url).fecha ?? hoy() })
  return json({ ok: true, dia: await leerDiaCompartible(env, sesion.usuarioId, fecha) })
}
