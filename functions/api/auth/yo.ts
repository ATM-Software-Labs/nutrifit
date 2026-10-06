import type { Handler } from '../../utils/env.ts'
import { json } from '../../utils/response.ts'
import { cookieBorrada } from '../../utils/session.ts'
import { obtenerUsuario } from '../../utils/usuarios.ts'

/**
 * GET /api/auth/yo — perfil del usuario de la sesión.
 * Sin sesión responde 200 con `usuario: null` (no 401): la app lo consulta en
 * cada arranque y así no ensucia la consola del navegador con errores de red.
 */
export const onRequestGet: Handler = async ({ env, data }) => {
  const anonimo = (borrarCookie: boolean) =>
    json({ ok: true, usuario: null, perfilCompleto: false }, borrarCookie ? { headers: { 'Set-Cookie': cookieBorrada() } } : {})
  if (!data.sesion) return anonimo(false)
  const usuario = await obtenerUsuario(env, data.sesion.usuarioId)
  if (!usuario) return anonimo(true)
  return json({ ok: true, usuario, perfilCompleto: usuario.meta_calorias !== null })
}
