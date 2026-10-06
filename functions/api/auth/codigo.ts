/**
 * POST /api/auth/codigo  { email, codigo, cliente?: 'web' | 'app' }
 * Alternativa al magic link: el código de 6 cifras del mismo email.
 * Límites: 20 / 15 min por IP y 10 / 15 min por email, además de 5 intentos
 * por código (al 5.º fallo se invalida). Web → cookie nf_session; app → Bearer.
 */
import type { Handler } from '../../utils/env.ts'
import { HttpError, json } from '../../utils/response.ts'
import { leerBody } from '../../utils/http.ts'
import { codigoSchema } from '../../utils/schemas.ts'
import { claveLimite, exigirLimite } from '../../utils/rateLimit.ts'
import { cerrarSolicitudesLogin, verificarCodigoLogin } from '../../utils/codigoLogin.ts'
import { crearCookieSesion, crearTokenApp } from '../../utils/session.ts'
import { asegurarUsuario, obtenerUsuario } from '../../utils/usuarios.ts'

const LIMITE = 'Demasiados intentos. Espera unos minutos y pide un código nuevo.'

export const onRequestPost: Handler = async ({ request, env, data }) => {
  await exigirLimite(env, await claveLimite('codigo:ip', data.ip), 20, 900, LIMITE)
  const { email, codigo, cliente } = await leerBody(request, codigoSchema)
  await exigirLimite(env, await claveLimite('codigo:email', email), 10, 900, LIMITE)

  const r = await verificarCodigoLogin(env, email, codigo)
  if (!r.ok) {
    throw r.motivo === 'agotado'
      ? new HttpError(410, 'Has agotado los intentos. Pide un código nuevo.', { codigo: 'agotado' })
      : new HttpError(400, 'Código incorrecto o caducado.', { codigo: 'codigo_invalido' })
  }
  const u = await asegurarUsuario(env, r.email)
  if (!u) throw new HttpError(500, 'No se pudo iniciar sesión.')
  await cerrarSolicitudesLogin(env, r.email) // el enlace del mismo email deja de valer
  const usuario = await obtenerUsuario(env, u.id)
  const perfilCompleto = usuario?.meta_calorias != null

  if (cliente === 'app') {
    const { token, exp } = await crearTokenApp(env, u.id, u.email)
    return json({ ok: true, token, expira: exp, usuario, perfilCompleto })
  }
  return json({ ok: true, usuario, perfilCompleto }, { headers: { 'Set-Cookie': await crearCookieSesion(env, u.id, u.email) } })
}
