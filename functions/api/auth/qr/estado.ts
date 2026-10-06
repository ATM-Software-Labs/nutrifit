/**
 * POST /api/auth/qr/estado  { id, secreto }   (PC, sondeo cada ~2 s)
 * pendiente | rechazado | caducado | invalido | aprobado (+ cookie de sesión
 * NUEVA, entregada una sola vez). Límite: 90 / min por IP.
 */
import type { Handler } from '../../../utils/env.ts'
import { json } from '../../../utils/response.ts'
import { leerBody } from '../../../utils/http.ts'
import { qrEstadoSchema } from '../../../utils/schemas.ts'
import { claveLimite, exigirLimite } from '../../../utils/rateLimit.ts'
import { estadoEmparejamiento } from '../../../utils/emparejamiento.ts'
import { crearCookieSesion } from '../../../utils/session.ts'
import { obtenerUsuario } from '../../../utils/usuarios.ts'

export const onRequestPost: Handler = async ({ request, env, data }) => {
  await exigirLimite(env, await claveLimite('qr:estado:ip', data.ip), 90, 60)
  const { id, secreto } = await leerBody(request, qrEstadoSchema)
  const r = await estadoEmparejamiento(env, id, secreto)
  if (r.estado !== 'aprobado') return json({ ok: true, ...r })
  const usuario = await obtenerUsuario(env, r.usuarioId)
  if (!usuario) return json({ ok: true, estado: 'invalido' })
  return json(
    { ok: true, estado: 'aprobado', usuario, perfilCompleto: usuario.meta_calorias !== null },
    { headers: { 'Set-Cookie': await crearCookieSesion(env, usuario.id, usuario.email) } },
  )
}
