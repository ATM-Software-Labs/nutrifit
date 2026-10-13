/**
 * GET/PUT /api/preferencias/cantidades — última cantidad por producto y
 * «todas las bebidas suman al agua», sincronizadas entre dispositivos.
 * PUT fusiona con lo guardado (gana lo más reciente) y devuelve el resultado.
 */
import { z } from 'zod'
import type { Env, Handler } from '../../utils/env.ts'
import { json } from '../../utils/response.ts'
import { exigirSesion } from '../../utils/session.ts'
import { leerBody } from '../../utils/http.ts'
import { exigirLimite } from '../../utils/rateLimit.ts'
import { MAX_PRODUCTOS, fusionar, type PrefCantidades } from '../../../src/lib/preferenciasCantidades.ts'

const entrada = z.strictObject({ cantidad: z.number().finite().min(0.1).max(10000), clave: z.string().max(12).optional(), t: z.number().int().min(0).max(4102444800000) })
const esquema = z.strictObject({
  aguaTodasBebidas: z.boolean(),
  aguaT: z.number().int().min(0).max(4102444800000),
  cantidades: z.record(z.string().min(1).max(80), entrada).refine((r) => Object.keys(r).length <= MAX_PRODUCTOS, { error: 'Demasiados productos.' }),
})

async function leer(env: Env, usuarioId: string): Promise<PrefCantidades> {
  const f = await env.DB.prepare('SELECT agua_todas_bebidas, agua_t, cantidades_json FROM preferencias_cantidades WHERE usuario_id = ?1').bind(usuarioId).first<{ agua_todas_bebidas: number; agua_t: number; cantidades_json: string }>()
  if (!f) return { aguaTodasBebidas: false, aguaT: 0, cantidades: {} }
  let cantidades: PrefCantidades['cantidades'] = {}
  try { cantidades = JSON.parse(f.cantidades_json) } catch { /* corrupto: vacío */ }
  return { aguaTodasBebidas: f.agua_todas_bebidas === 1, aguaT: f.agua_t, cantidades }
}

export const onRequestGet: Handler = async ({ env, data }) => json({ ok: true, ...(await leer(env, exigirSesion(data.sesion).usuarioId)) })

export const onRequestPut: Handler = async ({ request, env, data }) => {
  const { usuarioId } = exigirSesion(data.sesion)
  await exigirLimite(env, `prefcant:u:${usuarioId}`, 120, 3600)
  const nuevo = await leerBody(request, esquema, 48 * 1024)
  const r = fusionar(await leer(env, usuarioId), nuevo)
  await env.DB.prepare(
    `INSERT INTO preferencias_cantidades (usuario_id, agua_todas_bebidas, agua_t, cantidades_json, actualizado) VALUES (?1, ?2, ?3, ?4, unixepoch())
     ON CONFLICT (usuario_id) DO UPDATE SET agua_todas_bebidas = excluded.agua_todas_bebidas, agua_t = excluded.agua_t, cantidades_json = excluded.cantidades_json, actualizado = excluded.actualizado`,
  ).bind(usuarioId, r.aguaTodasBebidas ? 1 : 0, r.aguaT, JSON.stringify(r.cantidades)).run()
  return json({ ok: true, ...r })
}
