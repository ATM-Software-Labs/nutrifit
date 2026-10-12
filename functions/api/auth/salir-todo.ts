import type { Handler } from '../../utils/env.ts'
import { json } from '../../utils/response.ts'
import { cabeceraSetCookies, cookiesBorrado } from '../../utils/session.ts'

/** POST /api/auth/salir-todo — revoca todas las sesiones web y tokens de app del usuario. */
export const onRequestPost: Handler = async ({ env, data }) => {
  const id = data.sesion?.usuarioId
  if (!id) return json({ error: 'No autenticado' }, { status: 401 })
  const ahora = Math.floor(Date.now() / 1000)
  await env.DB.batch([
    env.DB.prepare('UPDATE sesiones_web SET revocado_en = ?1 WHERE usuario_id = ?2 AND revocado_en IS NULL').bind(ahora, id),
    env.DB.prepare('UPDATE tokens_app SET revocado_en = ?1 WHERE usuario_id = ?2 AND revocado_en IS NULL').bind(ahora, id),
  ])
  return json({ ok: true }, { headers: cabeceraSetCookies(cookiesBorrado()) })
}
