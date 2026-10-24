/**
 * GET  /api/compartir — enlaces públicos del usuario (Ajustes › Privacidad).
 * POST /api/compartir — crea /d/<token>. La instantánea se rehace en el servidor desde D1
 *   y se filtra con las opciones de privacidad: nunca se guarda lo que manda el cliente.
 *   `og` (opcional) es el PNG 1200×630 de la vista previa; se valida firma, tamaño y medidas.
 */
import { z } from 'zod'
import type { Handler } from '../../utils/env.ts'
import { HttpError, json } from '../../utils/response.ts'
import { leerBody } from '../../utils/http.ts'
import { fecha } from '../../utils/schemas.ts'
import { exigirSesion } from '../../utils/session.ts'
import { exigirLimite } from '../../utils/rateLimit.ts'
import { leerDiaCompartible } from '../../utils/compartirDb.ts'
import { aplicarPrivacidad, base64ABytes, estadoEnlace, expiraEn, nuevoToken, validarPngOg, leerDia } from '../../utils/compartir.ts'
import { origenPublico } from '../../utils/compartirUrl.ts'

const crearSchema = z.object({
  fecha,
  opciones: z.object({ ocultarKcal: z.boolean(), ocultarPesoRacha: z.boolean(), soloEmojis: z.boolean(), mostrarNombre: z.boolean() }).strict(),
  expira: z.enum(['1d', '7d', '30d', 'nunca']).default('7d'),
  og: z.string().max(420_000).regex(/^[A-Za-z0-9+/=]+$/).optional(),
}).strict()

export const onRequestGet: Handler = async ({ env, data }) => {
  const { usuarioId } = exigirSesion(data.sesion)
  const filas = (await env.DB.prepare('SELECT token, fecha, datos_json, creado_en, expira_en, revocado_en, visitas FROM dias_compartidos WHERE usuario_id = ?1 ORDER BY creado_en DESC LIMIT 100').bind(usuarioId).all<{ token: string; fecha: string; datos_json: string; creado_en: string; expira_en: string | null; revocado_en: string | null; visitas: number }>()).results ?? []
  const origen = origenPublico(env)
  return json({
    ok: true,
    enlaces: filas.map((f) => {
      const d = leerDia(f.datos_json)
      return { token: f.token, url: `${origen}/d/${f.token}`, fecha: f.fecha, creado_en: f.creado_en, expira_en: f.expira_en, estado: estadoEnlace(f), visitas: f.visitas, emojis: d ? d.grupos.flatMap((g) => g.items.map((i) => i.emoji)).slice(0, 8).join('') : '' }
    }),
  })
}

export const onRequestPost: Handler = async ({ request, env, data }) => {
  const { usuarioId } = exigirSesion(data.sesion)
  const b = await leerBody(request, crearSchema, 440 * 1024)
  await exigirLimite(env, `compartir:u:${usuarioId}`, 40, 86400, 'Has creado muchos enlaces hoy. Prueba mañana.')
  const activos = await env.DB.prepare('SELECT COUNT(*) AS n FROM dias_compartidos WHERE usuario_id = ?1 AND revocado_en IS NULL AND (expira_en IS NULL OR expira_en > ?2)').bind(usuarioId, new Date().toISOString()).first<{ n: number }>()
  if ((activos?.n ?? 0) >= 50) throw new HttpError(409, 'Tienes demasiados enlaces activos. Revoca alguno en Ajustes › Privacidad.')
  let og: Uint8Array | null = null
  if (b.og) {
    og = base64ABytes(b.og)
    if (!validarPngOg(og)) throw new HttpError(400, 'La vista previa no es un PNG 1200×630 de menos de 300 KB.')
  }
  const dia = aplicarPrivacidad(await leerDiaCompartible(env, usuarioId, b.fecha), b.opciones)
  const token = nuevoToken()
  const expira = expiraEn(b.expira)
  await env.DB.prepare('INSERT INTO dias_compartidos (token, usuario_id, fecha, datos_json, opciones_json, og_png, expira_en) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)')
    .bind(token, usuarioId, b.fecha, JSON.stringify(dia), JSON.stringify(b.opciones), og, expira)
    .run()
  return json({ ok: true, token, url: `${origenPublico(env)}/d/${token}`, expira_en: expira }, { status: 201 })
}
