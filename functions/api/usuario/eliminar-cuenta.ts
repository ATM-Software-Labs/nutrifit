/**
 * POST /api/usuario/eliminar-cuenta
 * Cuerpo: { "confirmar": "ELIMINAR" }. Borra la cuenta en nutrifit-db y la sesión.
 */
import type { Handler } from '../../utils/env.ts'
import { leerJson, validar } from '../../utils/http.ts'
import { eliminarCuentaSchema } from '../../utils/schemas.ts'
import { exigirSesion, cabeceraSetCookies, cookiesBorrado } from '../../utils/session.ts'
import { exigirLimite } from '../../utils/rateLimit.ts'
import { borrarCuenta } from '../../utils/cuenta.ts'
import { error, json } from '../../utils/response.ts'

export const onRequestPost: Handler = async ({ request, env, data }) => {
  const sesion = exigirSesion(data.sesion)
  await exigirLimite(env, `borrar-cuenta:u:${sesion.usuarioId}`, 5, 3600, 'Demasiados intentos de borrado. Espera un rato.')
  validar(eliminarCuentaSchema, await leerJson(request))
  const borrada = await borrarCuenta(env, sesion.usuarioId, sesion.email)
  if (!borrada) return error(404, 'No encontramos tu cuenta.')
  const headers = cabeceraSetCookies(cookiesBorrado())
  headers.set('cache-control', 'no-store')
  return json({ ok: true }, { headers })
}
