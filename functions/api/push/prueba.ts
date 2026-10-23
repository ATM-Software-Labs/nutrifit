/**
 * POST /api/push/prueba — envía ahora un aviso de prueba con el mismo formato que los de las franjas
 * (título corto, vibración, botones "Ya comí" / "Saltar hoy" / "Apuntar"). Los botones de la prueba
 * no marcan nada: su franja es 'prueba'.
 */
import type { Handler } from '../../utils/env.ts'
import { json } from '../../utils/response.ts'
import { exigirSesion } from '../../utils/session.ts'
import { HttpError } from '../../utils/response.ts'
import { enviarPush, vapidDeEnv } from '../../utils/webpush.ts'
import { avisoFranja, tokenAccion } from '../../utils/accionAviso.ts'

export const onRequestPost: Handler = async ({ env, data }) => {
  const { usuarioId: id } = exigirSesion(data.sesion)
  const v = vapidDeEnv(env)
  if (!v) throw new HttpError(503, 'Las notificaciones push no están configuradas todavía.')
  const subs = (await env.DB.prepare('SELECT endpoint_hash, endpoint, p256dh, auth FROM push_suscripciones WHERE usuario_id = ?1').bind(id).all<{ endpoint_hash: string; endpoint: string; p256dh: string; auth: string }>()).results ?? []
  const fecha = new Date().toISOString().slice(0, 10)
  const token = env.AUTH_SECRET ? await tokenAccion(env.AUTH_SECRET, id, 'prueba', fecha) : null
  const aviso = avisoFranja({ titulo: '🍽️ ¿Ya has comido?', cuerpo: 'Aviso de prueba: así te llegará al móvil y al reloj.', url: '/?apuntar=comida', franja: 'prueba', fecha, token })
  let ok = 0
  for (const s of subs) {
    const st = await enviarPush(s, aviso, v, 600).catch(() => 0)
    if (st >= 200 && st < 300) ok++
    else if (st === 404 || st === 410) await env.DB.prepare('DELETE FROM push_suscripciones WHERE endpoint_hash = ?1').bind(s.endpoint_hash).run()
  }
  return json({ enviados: ok, dispositivos: subs.length })
}
