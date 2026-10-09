/**
 * GET /api/usuario/exportar-datos
 * JSON de portabilidad: perfil, diario, peso, agua y entrenamientos de la sesión.
 */
import type { Handler } from '../../utils/env.ts'
import { exigirSesion } from '../../utils/session.ts'
import { exigirLimite } from '../../utils/rateLimit.ts'
import { volcadoCuenta } from '../../utils/cuenta.ts'
import { error } from '../../utils/response.ts'

export const onRequestGet: Handler = async ({ env, data }) => {
  const sesion = exigirSesion(data.sesion)
  await exigirLimite(env, `portabilidad:u:${sesion.usuarioId}`, 10, 3600, 'Has pedido demasiados volcados. Espera un rato.')
  const volcado = await volcadoCuenta(env, sesion.usuarioId)
  if (!volcado) return error(404, 'No encontramos tu cuenta.')
  return new Response(JSON.stringify(volcado), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': 'attachment; filename="nutrifit-datos.json"',
      'cache-control': 'no-store',
    },
  })
}
