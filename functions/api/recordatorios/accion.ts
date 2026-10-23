/**
 * POST /api/recordatorios/accion — botones de la notificación de una franja, sin abrir la app.
 *   { t, accion: 'hecho' | 'saltar' }  ← lo envía el service worker con el token firmado del aviso
 *   { franja, fecha, accion }          ← alternativa con sesión (desde la propia app)
 * 'hecho' = "Ya comí" (no hace falta apuntarla para que deje de avisar; cuenta para el aviso de cierre).
 * 'saltar' = "Saltar hoy". Ambas dejan esa franja sin más avisos ese día.
 */
import { z } from 'zod'
import type { Handler } from '../../utils/env.ts'
import { HttpError, json } from '../../utils/response.ts'
import { leerBody } from '../../utils/http.ts'
import { leerTokenAccion } from '../../utils/accionAviso.ts'
import { claveFranja, claveHecho, claveSaltada } from '../../utils/franjas.ts'

const esquema = z.object({
  accion: z.enum(['hecho', 'saltar']),
  t: z.string().max(600).optional(),
  franja: z.string().regex(/^(prueba|desayuno|media_manana|comida|merienda|cena|p_[a-z0-9]{1,20})$/).optional(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export const onRequestPost: Handler = async ({ request, env, data }) => {
  const b = await leerBody(request, esquema)
  let u: string, f: string, d: string
  const tok = b.t && env.AUTH_SECRET ? await leerTokenAccion(env.AUTH_SECRET, b.t) : null
  if (tok) {
    u = tok.u; f = tok.f; d = tok.d
  } else if (data.sesion && b.franja && b.fecha) {
    u = data.sesion.usuarioId; f = b.franja; d = b.fecha
  } else throw new HttpError(b.t ? 403 : 401, b.t ? 'El aviso ha caducado. Abre la app para apuntarlo.' : 'Necesitas iniciar sesión.')
  if (f === 'prueba') return json({ ok: true, prueba: true })
  const marca = b.accion === 'hecho' ? claveHecho(f) : claveSaltada(f)
  await env.DB.batch([
    env.DB.prepare('INSERT OR IGNORE INTO recordatorios_envios (usuario_id, fecha, clave, canal) VALUES (?1, ?2, ?3, ?4)').bind(u, d, marca, 'notificacion'),
    env.DB.prepare('INSERT OR IGNORE INTO recordatorios_envios (usuario_id, fecha, clave, canal) VALUES (?1, ?2, ?3, ?4)').bind(u, d, claveFranja(f), 'notificacion'),
  ])
  return json({ ok: true })
}
