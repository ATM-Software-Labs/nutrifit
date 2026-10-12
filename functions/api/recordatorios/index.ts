/** GET/PUT /api/recordatorios — preferencias de recordatorios del usuario. */
import { z } from 'zod'
import type { Handler } from '../../utils/env.ts'
import { json } from '../../utils/response.ts'
import { exigirSesion } from '../../utils/session.ts'
import { validar } from '../../utils/http.ts'
import { PREF_POR_DEFECTO, TIPOS_AVISO, canalesDe } from '../../utils/recordatorios.ts'
import { vapidDeEnv } from '../../utils/webpush.ts'

const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
const esquema = z.object({
  activo: z.boolean(),
  zona: z.string().max(50).refine((z) => { try { new Intl.DateTimeFormat('es', { timeZone: z }); return true } catch { return false } }),
  desayuno: hora.nullable(),
  comida: hora.nullable(),
  cena: hora.nullable(),
  snack: hora.nullable(),
  cierre: hora.nullable(),
  agua: z.boolean(),
  email: z.boolean(),
  resumen_semanal: z.boolean(),
  silencio_desde: hora,
  silencio_hasta: hora,
  max_dia: z.number().int().min(1).max(10),
  canales: z.record(z.enum(TIPOS_AVISO), z.object({ push: z.boolean(), email: z.boolean(), app: z.boolean() })).optional(),
})

async function leer(env: Parameters<Handler>[0]['env'], id: string) {
  const fila = await env.DB.prepare('SELECT * FROM recordatorios_pref WHERE usuario_id = ?1').bind(id).first<Record<string, unknown>>()
  const subs = await env.DB.prepare('SELECT COUNT(*) AS n FROM push_suscripciones WHERE usuario_id = ?1').bind(id).first<{ n: number }>()
  const p = { ...PREF_POR_DEFECTO, activo: 0, ...(fila ?? {}) } as Record<string, unknown>
  for (const k of ['activo', 'agua', 'email', 'resumen_semanal']) p[k] = !!p[k]
  p.canales = Object.fromEntries(TIPOS_AVISO.map((k) => [k, canalesDe({ email: 0, canales_json: (fila?.canales_json as string) ?? null }, k)]))
  delete p.canales_json
  delete p.baja_token
  delete p.usuario_id
  return { preferencias: p, dispositivosPush: subs?.n ?? 0, vapidPublica: env.VAPID_PUBLIC_KEY ?? null, pushDisponible: !!vapidDeEnv(env) }
}

export const onRequestGet: Handler = async ({ env, data }) => json(await leer(env, exigirSesion(data.sesion).usuarioId))

export const onRequestPut: Handler = async ({ request, env, data }) => {
  const { usuarioId: id } = exigirSesion(data.sesion)
  const p = validar(esquema, await request.json())
  const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
  await env.DB.prepare(
    `INSERT INTO recordatorios_pref (usuario_id, activo, zona, desayuno, comida, cena, snack, cierre, agua, email, resumen_semanal, silencio_desde, silencio_hasta, max_dia, baja_token, canales_json, actualizado_en)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, CURRENT_TIMESTAMP)
     ON CONFLICT (usuario_id) DO UPDATE SET activo = ?2, zona = ?3, desayuno = ?4, comida = ?5, cena = ?6, snack = ?7, cierre = ?8, agua = ?9, email = ?10,
       resumen_semanal = ?11, silencio_desde = ?12, silencio_hasta = ?13, max_dia = ?14, baja_token = COALESCE(baja_token, ?15), canales_json = COALESCE(?16, canales_json), actualizado_en = CURRENT_TIMESTAMP`,
  ).bind(id, +p.activo, p.zona, p.desayuno, p.comida, p.cena, p.snack, p.cierre, +p.agua, +p.email, +p.resumen_semanal, p.silencio_desde, p.silencio_hasta, p.max_dia, token, p.canales ? JSON.stringify(p.canales) : null).run()
  return json(await leer(env, id))
}
