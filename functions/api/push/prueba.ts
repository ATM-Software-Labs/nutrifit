/** POST /api/push/prueba — envía un aviso de prueba a los dispositivos del usuario. */
import type { Handler } from '../../utils/env.ts'
import { json } from '../../utils/response.ts'
import { exigirSesion } from '../../utils/session.ts'
import { HttpError } from '../../utils/response.ts'
import { enviarPush, vapidDeEnv } from '../../utils/webpush.ts'

export const onRequestPost: Handler = async ({ env, data }) => {
  const { usuarioId: id } = exigirSesion(data.sesion)
  const v = vapidDeEnv(env)
  if (!v) throw new HttpError(503, 'Las notificaciones push no están configuradas todavía.')
  const subs = (await env.DB.prepare('SELECT endpoint_hash, endpoint, p256dh, auth FROM push_suscripciones WHERE usuario_id = ?1').bind(id).all<{ endpoint_hash: string; endpoint: string; p256dh: string; auth: string }>()).results ?? []
  let ok = 0
  for (const s of subs) {
    const st = await enviarPush(s, { titulo: 'NutriFit', cuerpo: 'Así te llegarán los recordatorios. ¡Todo listo!', url: '/', etiqueta: 'prueba' }, v, 600).catch(() => 0)
    if (st >= 200 && st < 300) ok++
    else if (st === 404 || st === 410) await env.DB.prepare('DELETE FROM push_suscripciones WHERE endpoint_hash = ?1').bind(s.endpoint_hash).run()
  }
  return json({ enviados: ok, dispositivos: subs.length })
}
