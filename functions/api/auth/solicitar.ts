import { esProduccion, type Handler } from '../../utils/env.ts'
import { json } from '../../utils/response.ts'
import { leerBody } from '../../utils/http.ts'
import { solicitarSchema } from '../../utils/schemas.ts'
import { claveLimite, exigirLimite } from '../../utils/rateLimit.ts'
import { crearMagicToken } from '../../utils/magicLink.ts'
import { enviarMagicLink } from '../../utils/email.ts'
import { crearCodigoLogin } from '../../utils/codigoLogin.ts'
import { origenLocalPages, URL_PASARELA } from '../../utils/pasarela.ts'

const MENSAJE_ENVIADO = 'Enlace y código enviados. Revisa tu bandeja de entrada o spam.'
const MENSAJE_RECIENTE = 'Ya te enviamos un código recientemente. Revisa tu correo o espera unos minutos.'
const LIMITE = 'Has pedido demasiados enlaces. Espera unos minutos antes de volver a intentarlo.'

export const onRequestPost: Handler = async (ctx) => {
  const { request, env, data } = ctx
  const { email, cliente } = await leerBody(request, solicitarSchema)

  await exigirLimite(env, await claveLimite('auth:ip', data.ip), 5, 900, LIMITE)
  await exigirLimite(env, await claveLimite('auth:email', email), 5, 900, LIMITE)

  const ahora = Math.floor(Date.now() / 1000)

  // 1. Anti-spam Brevo: comprobar si ya tiene un codigo activo generado hace menos de 5 minutos (300s)
  const activoReciente = await env.DB.prepare(
    `SELECT expira_en FROM codigos_login 
     WHERE email = ?1 AND usado_en IS NULL AND expira_en > ?2 
     ORDER BY rowid DESC LIMIT 1`
  )
    .bind(email, ahora)
    .first<{ expira_en: number }>()

  // Si le quedan mas de 3 horas y 55 minutos (se creo hace menos de 5 min) no llamamos a Brevo
  if (activoReciente && (activoReciente.expira_en - ahora) > (4 * 3600 - 300)) {
    return json({ ok: true, mensaje: MENSAJE_RECIENTE })
  }

  // 2. Generar tokens con 4 horas de validez
  const local = origenLocalPages(request.url)
  const base = local ?? (env.APP_URL?.startsWith('http') ? env.APP_URL : esProduccion(env) ? 'https://nutri.trujillomingorance.com' : new URL(request.url).origin)
  const token = await crearMagicToken(env, email)
  const raiz = base.replace(/\/$/, '')
  // La web entra por el gateway para que la cookie __Host- quede en el host del API.
  const enlace =
    cliente === 'app'
      ? `${raiz}/app-login?token=${encodeURIComponent(token)}`
      : local
        ? `${raiz}/api/auth/verificar?token=${encodeURIComponent(token)}`
        : `${URL_PASARELA}/v1/auth/verificar?token=${encodeURIComponent(token)}`

  const codigo = await crearCodigoLogin(env, email)

  // 3. Enviar a Brevo solo si paso el cooldown
  ctx.waitUntil(enviarMagicLink(env, email, enlace, codigo))
  return json({ ok: true, mensaje: MENSAJE_ENVIADO })
}
