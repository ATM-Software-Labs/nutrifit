/**
 * GET/PUT /api/recordatorios — preferencias de recordatorios del usuario.
 * Incluye las franjas por comida (recordatorios_franjas) y sugerencias sacadas del historial.
 */
import { z } from 'zod'
import type { Handler } from '../../utils/env.ts'
import { json } from '../../utils/response.ts'
import { exigirSesion } from '../../utils/session.ts'
import { validar } from '../../utils/http.ts'
import { PREF_POR_DEFECTO, TIPOS_AVISO, canalesDe } from '../../utils/recordatorios.ts'
import { vapidDeEnv } from '../../utils/webpush.ts'
import { aMin } from '../../utils/recordatorios.ts'
import { FRANJAS_POR_DEFECTO, MAX_FRANJAS, franjaDeFila, type FilaFranja, franjasEfectivas, minutoAviso, minutoDeRegistro, sugerirFranjas, type Franja } from '../../utils/franjas.ts'
import { HttpError } from '../../utils/response.ts'

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
  franjas: z
    .array(
      z.object({
        id: z.string().regex(/^(desayuno|media_manana|comida|merienda|cena|p_[a-z0-9]{1,20})$/),
        nombre: z.string().trim().min(1).max(30),
        tipo: z.enum(['desayuno', 'comida', 'cena', 'snack']),
        inicio: hora,
        fin: hora,
        aviso_min: z.number().int().min(0).max(1440).nullable(),
        dias: z.number().int().min(1).max(127),
        activo: z.boolean(),
        orden: z.number().int().min(0).max(99),
      }),
    )
    .max(MAX_FRANJAS)
    .optional(),
})

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

/** Horas antiguas (una por comida) a partir de las franjas: las usa la app nativa para sus avisos locales. */
export function horasLegado(fs: Franja[]): { desayuno: string | null; comida: string | null; cena: string | null; snack: string | null } {
  const de = (tipo: string) => {
    const f = fs.filter((x) => x.activo && x.tipo === tipo).sort((a, b) => aMin(a.inicio) - aMin(b.inicio))[0]
    return f ? hhmm(Math.min(minutoAviso(f), 23 * 60 + 59)) : null
  }
  return { desayuno: de('desayuno'), comida: de('comida'), cena: de('cena'), snack: de('snack') }
}

async function leer(env: Parameters<Handler>[0]['env'], id: string) {
  const fila = await env.DB.prepare('SELECT * FROM recordatorios_pref WHERE usuario_id = ?1').bind(id).first<Record<string, unknown>>()
  const subs = await env.DB.prepare('SELECT COUNT(*) AS n FROM push_suscripciones WHERE usuario_id = ?1').bind(id).first<{ n: number }>()
  const p = { ...PREF_POR_DEFECTO, activo: 0, ...(fila ?? {}) } as Record<string, unknown>
  for (const k of ['activo', 'agua', 'email', 'resumen_semanal']) p[k] = !!p[k]
  p.canales = Object.fromEntries(TIPOS_AVISO.map((k) => [k, canalesDe({ email: 0, canales_json: (fila?.canales_json as string) ?? null }, k)]))
  delete p.canales_json
  delete p.baja_token
  delete p.usuario_id
  const zona = (p.zona as string) || 'Europe/Madrid'
  const [franjasRes, historial] = await env.DB.batch([
    env.DB.prepare('SELECT id, nombre, tipo_comida, inicio, fin, aviso_min, dias, activo, orden FROM recordatorios_franjas WHERE usuario_id = ?1').bind(id),
    env.DB.prepare("SELECT fecha, hora, creado_en, tipo_comida FROM diario_comidas WHERE usuario_id = ?1 AND fecha >= date('now', '-60 days')").bind(id),
  ])
  const guardadas = ((franjasRes?.results ?? []) as FilaFranja[]).map(franjaDeFila)
  const franjas = franjasEfectivas(guardadas, fila ? (p as { desayuno: string | null; comida: string | null; cena: string | null; snack: string | null }) : null)
  const regs = ((historial?.results ?? []) as { fecha: string; hora: string | null; creado_en: string; tipo_comida: string }[])
    .map((r) => ({ fecha: r.fecha, tipo: r.tipo_comida, min: minutoDeRegistro(r, zona) }))
    .filter((r): r is { fecha: string; tipo: string; min: number } => r.min !== null)
  return {
    preferencias: p,
    franjas,
    franjasPersonalizadas: guardadas.length > 0,
    franjasPorDefecto: FRANJAS_POR_DEFECTO,
    sugerencias: sugerirFranjas(regs),
    dispositivosPush: subs?.n ?? 0,
    vapidPublica: env.VAPID_PUBLIC_KEY ?? null,
    pushDisponible: !!vapidDeEnv(env),
  }
}

export const onRequestGet: Handler = async ({ env, data }) => json(await leer(env, exigirSesion(data.sesion).usuarioId))

export const onRequestPut: Handler = async ({ request, env, data }) => {
  const { usuarioId: id } = exigirSesion(data.sesion)
  const p = validar(esquema, await request.json())
  if (p.franjas) {
    const ids = new Set<string>()
    for (const f of p.franjas) {
      if (ids.has(f.id)) throw new HttpError(400, `Franja repetida: ${f.nombre}`)
      ids.add(f.id)
      if (aMin(f.fin) <= aMin(f.inicio)) throw new HttpError(400, `${f.nombre}: la hora de fin debe ser posterior a la de inicio`)
    }
    Object.assign(p, horasLegado(p.franjas))
  }
  const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
  await env.DB.prepare(
    `INSERT INTO recordatorios_pref (usuario_id, activo, zona, desayuno, comida, cena, snack, cierre, agua, email, resumen_semanal, silencio_desde, silencio_hasta, max_dia, baja_token, canales_json, actualizado_en)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, CURRENT_TIMESTAMP)
     ON CONFLICT (usuario_id) DO UPDATE SET activo = ?2, zona = ?3, desayuno = ?4, comida = ?5, cena = ?6, snack = ?7, cierre = ?8, agua = ?9, email = ?10,
       resumen_semanal = ?11, silencio_desde = ?12, silencio_hasta = ?13, max_dia = ?14, baja_token = COALESCE(baja_token, ?15), canales_json = COALESCE(?16, canales_json), actualizado_en = CURRENT_TIMESTAMP`,
  ).bind(id, +p.activo, p.zona, p.desayuno, p.comida, p.cena, p.snack, p.cierre, +p.agua, +p.email, +p.resumen_semanal, p.silencio_desde, p.silencio_hasta, p.max_dia, token, p.canales ? JSON.stringify(p.canales) : null).run()
  if (p.franjas) {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM recordatorios_franjas WHERE usuario_id = ?1').bind(id),
      ...p.franjas.map((f) =>
        env.DB.prepare('INSERT INTO recordatorios_franjas (usuario_id, id, nombre, tipo_comida, inicio, fin, aviso_min, dias, activo, orden) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)')
          .bind(id, f.id, f.nombre, f.tipo, f.inicio, f.fin, f.aviso_min, f.dias, +f.activo, f.orden),
      ),
    ])
  }
  return json(await leer(env, id))
}
