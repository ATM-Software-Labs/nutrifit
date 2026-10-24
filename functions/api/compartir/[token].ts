/** DELETE /api/compartir/:token — revoca un enlace (solo el dueño). La vista previa se borra. */
import type { Handler } from '../../utils/env.ts'
import { HttpError, json } from '../../utils/response.ts'
import { exigirSesion } from '../../utils/session.ts'
import { TOKEN_RE } from '../../utils/compartir.ts'

export const onRequestDelete: Handler = async ({ env, data, params }) => {
  const { usuarioId } = exigirSesion(data.sesion)
  const token = String(params.token ?? '')
  if (!TOKEN_RE.test(token)) throw new HttpError(404, 'Enlace no encontrado.')
  const r = await env.DB.prepare("UPDATE dias_compartidos SET revocado_en = COALESCE(revocado_en, strftime('%Y-%m-%dT%H:%M:%fZ','now')), og_png = NULL WHERE token = ?1 AND usuario_id = ?2").bind(token, usuarioId).run()
  if (!r.meta.changes) throw new HttpError(404, 'Enlace no encontrado.')
  return json({ ok: true })
}
