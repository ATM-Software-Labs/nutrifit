/**
 * POST /api/auth/token  { token }   (app Android)
 * Canjea el token de un magic link (firma + caducidad + un solo uso, igual que
 * /api/auth/verificar) por un token Bearer de 60 días, revocable.
 * La app lo guarda con @capacitor/preferences y lo envía en `Authorization`.
 */
import type { Handler } from '../../utils/env.ts'
import { HttpError, json } from '../../utils/response.ts'
import { leerBody } from '../../utils/http.ts'
import { canjeTokenSchema } from '../../utils/schemas.ts'
import { claveLimite, exigirLimite } from '../../utils/rateLimit.ts'
import { consumirMagicToken } from '../../utils/magicLink.ts'
import { cerrarSolicitudesLogin } from '../../utils/codigoLogin.ts'
import { crearTokenApp } from '../../utils/session.ts'
import { asegurarUsuario, obtenerUsuario } from '../../utils/usuarios.ts'

const MENSAJES = {
  invalido: 'El enlace no es válido. Pide uno nuevo.',
  caducado: 'El enlace ha caducado (dura 15 minutos). Pide uno nuevo.',
  usado: 'Este enlace ya se ha usado. Pide uno nuevo.',
} as const

export const onRequestPost: Handler = async ({ request, env, data }) => {
  await exigirLimite(env, await claveLimite('verificar:ip', data.ip), 30, 900)
  const { token } = await leerBody(request, canjeTokenSchema)
  const r = await consumirMagicToken(env, token)
  if (!r.ok) throw new HttpError(r.motivo === 'invalido' ? 400 : 410, MENSAJES[r.motivo], { codigo: r.motivo })

  const u = await asegurarUsuario(env, r.email)
  if (!u) throw new HttpError(500, 'No se pudo iniciar sesión.')
  await cerrarSolicitudesLogin(env, r.email)
  const { token: bearer, exp } = await crearTokenApp(env, u.id, u.email)
  const usuario = await obtenerUsuario(env, u.id)
  return json({ ok: true, token: bearer, expira: exp, usuario, perfilCompleto: usuario?.meta_calorias != null })
}
