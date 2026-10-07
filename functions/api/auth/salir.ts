import type { Handler } from '../../utils/env.ts'
import { json } from '../../utils/response.ts'
import { cabeceraSetCookies, cookiesBorrado, revocarFamiliaWeb, revocarTokenApp } from '../../utils/session.ts'

/** POST /api/auth/salir — borra la cookie (web) o revoca el token Bearer (app). */
export const onRequestPost: Handler = async ({ env, data }) => {
  if (data.sesion?.via === 'bearer' && data.sesion.jtiHash) {
    await revocarTokenApp(env, data.sesion.jtiHash)
    return json({ ok: true })
  }
  if (data.sesion?.familiaHash) await revocarFamiliaWeb(env, data.sesion.familiaHash)
  return json({ ok: true }, { headers: cabeceraSetCookies(cookiesBorrado()) })
}
