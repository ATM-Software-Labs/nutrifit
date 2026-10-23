/** GET/PUT /api/usuarios/plan-dia — horario de entreno, ajustes de metas por tipo de día, nombres de comidas y porción por defecto. */
import type { Handler } from '../../utils/env.ts'
import { json } from '../../utils/response.ts'
import { leerBody } from '../../utils/http.ts'
import { planDiaSchema } from '../../utils/schemas.ts'
import { exigirSesion } from '../../utils/session.ts'
import { exigirLimite } from '../../utils/rateLimit.ts'
import { PLAN_VACIO, type FilaPlan } from '../../utils/planDia.ts'

function aApi(f: FilaPlan) {
  let nombres: Record<string, string> = {}
  try { nombres = f.nombres_json ? (JSON.parse(f.nombres_json) as Record<string, string>) : {} } catch { /* ignora */ }
  return {
    horario_entreno: f.horario_entreno,
    auto: !!f.auto,
    entreno: { calorias: f.entreno_kcal, proteinas: f.entreno_prot, carbohidratos: f.entreno_carbs, grasas: f.entreno_grasas },
    descanso: { calorias: f.descanso_kcal, proteinas: f.descanso_prot, carbohidratos: f.descanso_carbs, grasas: f.descanso_grasas },
    nombres,
    porcion_g: f.porcion_g,
  }
}

export const onRequestGet: Handler = async ({ env, data }) => {
  const sesion = exigirSesion(data.sesion)
  const f = await env.DB.prepare('SELECT * FROM plan_dia WHERE usuario_id = ?1').bind(sesion.usuarioId).first<FilaPlan>()
  return json({ ok: true, plan: aApi(f ?? PLAN_VACIO) })
}

export const onRequestPut: Handler = async ({ request, env, data }) => {
  const sesion = exigirSesion(data.sesion)
  const b = await leerBody(request, planDiaSchema, 4096)
  await exigirLimite(env, `plandia:u:${sesion.usuarioId}`, 100, 86400)
  const nombres = Object.fromEntries(Object.entries(b.nombres ?? {}).filter(([, v]) => v))
  const f: FilaPlan = {
    horario_entreno: b.horario_entreno,
    auto: b.auto ? 1 : 0,
    entreno_kcal: b.entreno.calorias, entreno_prot: b.entreno.proteinas, entreno_carbs: b.entreno.carbohidratos, entreno_grasas: b.entreno.grasas,
    descanso_kcal: b.descanso.calorias, descanso_prot: b.descanso.proteinas, descanso_carbs: b.descanso.carbohidratos, descanso_grasas: b.descanso.grasas,
    nombres_json: Object.keys(nombres).length ? JSON.stringify(nombres) : null,
    porcion_g: b.porcion_g ?? null,
  }
  const cols = Object.keys(f) as (keyof FilaPlan)[]
  await env.DB.prepare(
    `INSERT INTO plan_dia (usuario_id, ${cols.join(', ')}, actualizado_en) VALUES (?1, ${cols.map((_, i) => `?${i + 2}`).join(', ')}, CURRENT_TIMESTAMP)
     ON CONFLICT(usuario_id) DO UPDATE SET ${cols.map((c) => `${c} = excluded.${c}`).join(', ')}, actualizado_en = CURRENT_TIMESTAMP`,
  )
    .bind(sesion.usuarioId, ...cols.map((c) => f[c]))
    .run()
  return json({ ok: true, plan: aApi(f) })
}
