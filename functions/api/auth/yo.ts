import type { Handler } from '../../utils/env.ts'
import { json } from '../../utils/response.ts'
import { cabeceraSetCookies, cookiesBorrado, revocarFamiliaWeb } from '../../utils/session.ts'
import { obtenerUsuario } from '../../utils/usuarios.ts'
import { desvincularStrava } from '../../utils/integraciones.ts'

/**
 * GET /api/auth/yo — perfil del usuario de la sesión.
 * Sin sesión responde 200 con `usuario: null` (no 401): la app lo consulta en
 * cada arranque y así no ensucia la consola del navegador con errores de red.
 */
export const onRequestGet: Handler = async (ctx) => {
  const { env, data } = ctx
  // No bloquea la respuesta. Si la tabla no existe o el SQL no cuadra, no lanza.
  ctx.waitUntil(desvincularStrava(env).catch(() => undefined))
  const anonimo = (borrarCookie: boolean) =>
    json({ ok: true, usuario: null, perfilCompleto: false }, borrarCookie ? { headers: cabeceraSetCookies(cookiesBorrado()) } : {})
  if (!data.sesion) return anonimo(false)
  const usuario = await obtenerUsuario(env, data.sesion.usuarioId)
  if (!usuario) {
    if (data.sesion.familiaHash) await revocarFamiliaWeb(env, data.sesion.familiaHash)
    return anonimo(true)
  }
  return json({ ok: true, usuario, perfilCompleto: usuario.meta_calorias !== null })
}
