/**
 * GET /api/integraciones — proveedores del usuario, sin tokens.
 * Strava se desvincula aquí y no se devuelve. El resto de filas no se modifica.
 */
import type { Handler } from '../../utils/env.ts'
import { json } from '../../utils/response.ts'
import { exigirIdentidad } from '../../utils/identidad.ts'
import { listarIntegraciones } from '../../utils/integraciones.ts'

export const onRequestGet: Handler = async ({ env, data }) => {
  const sesion = await exigirIdentidad(env, data.sesion)
  const integraciones = await listarIntegraciones(env, sesion.usuarioId)
  return json({ ok: true, integraciones })
}
