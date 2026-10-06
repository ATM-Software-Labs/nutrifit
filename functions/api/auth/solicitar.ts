/**
 * POST /api/auth/solicitar  { email, turnstileToken }
 * Turnstile lo valida el middleware. Respuesta SIEMPRE idéntica (200 genérico)
 * exista o no el email → sin enumeración de usuarios. El envío va en waitUntil
 * para que el tiempo de respuesta tampoco delate nada.
 */
import { esProduccion, type Handler } from '../../utils/env.ts'
import { json } from '../../utils/response.ts'
import { leerBody } from '../../utils/http.ts'
import { solicitarSchema } from '../../utils/schemas.ts'
import { claveLimite, exigirLimite } from '../../utils/rateLimit.ts'
import { crearMagicToken } from '../../utils/magicLink.ts'
import { enviarMagicLink } from '../../utils/brevo.ts'

const MENSAJE = 'Si el email es válido, en unos segundos recibirás un enlace para entrar. Revisa también la carpeta de spam.'
const LIMITE = 'Has pedido demasiados enlaces. Espera unos minutos antes de volver a intentarlo.'

export const onRequestPost: Handler = async (ctx) => {
  const { request, env, data } = ctx
  const { email } = await leerBody(request, solicitarSchema)

  await exigirLimite(env, await claveLimite('auth:ip', data.ip), 5, 900, LIMITE)
  await exigirLimite(env, await claveLimite('auth:email', email), 5, 900, LIMITE)

  // La base del enlace sale de APP_URL (config), NUNCA de la cabecera Host:
  // evita que un atacante haga enviar enlaces que apunten a su dominio.
  const base = env.APP_URL?.startsWith('http') ? env.APP_URL : esProduccion(env) ? 'https://nutri.trujillomingorance.com' : new URL(request.url).origin
  const token = await crearMagicToken(env, email)
  const enlace = `${base.replace(/\/$/, '')}/api/auth/verificar?token=${encodeURIComponent(token)}`

  ctx.waitUntil(enviarMagicLink(env, email, enlace))
  return json({ ok: true, mensaje: MENSAJE })
}
