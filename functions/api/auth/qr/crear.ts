/**
 * POST /api/auth/qr/crear  { secretoHash }   (PC sin sesión)
 * Crea un emparejamiento de 2 minutos. El navegador guarda el secreto y solo
 * envía su SHA-256. Devuelve { id, codigo, expira, url } para pintar el QR.
 * Límite: 20 / 10 min por IP.
 */
import type { Handler } from '../../../utils/env.ts'
import { esProduccion } from '../../../utils/env.ts'
import { json } from '../../../utils/response.ts'
import { leerBody } from '../../../utils/http.ts'
import { qrCrearSchema } from '../../../utils/schemas.ts'
import { claveLimite, exigirLimite } from '../../../utils/rateLimit.ts'
import { crearEmparejamiento, describirDispositivo, describirUbicacion } from '../../../utils/emparejamiento.ts'

export const onRequestPost: Handler = async ({ request, env, data }) => {
  await exigirLimite(env, await claveLimite('qr:crear:ip', data.ip), 20, 600, 'Has generado demasiados códigos QR. Espera unos minutos.')
  const { secretoHash } = await leerBody(request, qrCrearSchema)
  const r = await crearEmparejamiento(env, secretoHash, describirDispositivo(request.headers.get('User-Agent')), describirUbicacion((request as { cf?: unknown }).cf))
  const base = env.APP_URL?.startsWith('http') ? env.APP_URL : esProduccion(env) ? 'https://nutri.trujillomingorance.com' : new URL(request.url).origin
  // El id va en el fragmento (#): no llega a los logs del servidor ni al Referer.
  return json({ ok: true, ...r, url: `${base.replace(/\/$/, '')}/vincular#${r.id}` })
}
