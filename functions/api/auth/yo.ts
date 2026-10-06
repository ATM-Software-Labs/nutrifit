import type { Handler } from '../../utils/env.ts'
import { error, json } from '../../utils/response.ts'
import { cookieBorrada, exigirSesion } from '../../utils/session.ts'
import { obtenerUsuario } from '../../utils/usuarios.ts'

/** GET /api/auth/yo — perfil del usuario de la sesión, o 401. */
export const onRequestGet: Handler = async ({ env, data }) => {
  const sesion = exigirSesion(data.sesion)
  const usuario = await obtenerUsuario(env, sesion.usuarioId)
  if (!usuario) return error(401, 'Necesitas iniciar sesión.', {}, { 'Set-Cookie': cookieBorrada() })
  return json({ ok: true, usuario, perfilCompleto: usuario.meta_calorias !== null })
}
