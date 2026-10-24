/** Lee de D1 todo lo que sale en la tarjeta de un día (sin fotos ni datos de salud extra). */
import type { Env } from './env.ts'
import { construirDia, type DiaCompartido, type FilaDia, type TipoComidaDia } from './compartir.ts'
import { ajustarMetas, leerPlanDia, tipoEfectivo } from './planDia.ts'
import { calcularRacha, LOGROS } from './logros.ts'
import { ZONA_POR_DEFECTO } from './fechas.ts'

const fechaLocal = (utc: string, zona = ZONA_POR_DEFECTO) => {
  const d = new Date(utc.replace(' ', 'T') + (/[zZ]|[+-]\d\d:?\d\d$/.test(utc) ? '' : 'Z'))
  return new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

export async function leerDiaCompartible(env: Env, usuarioId: string, fecha: string): Promise<DiaCompartido> {
  const [comidas, agua, peso, fechas, usuario, logros] = await env.DB.batch([
    env.DB.prepare('SELECT tipo_comida, descripcion, calorias, proteinas, carbohidratos, grasas, emoji FROM diario_comidas WHERE usuario_id = ?1 AND fecha = ?2 ORDER BY creado_en').bind(usuarioId, fecha),
    env.DB.prepare('SELECT ml FROM registro_agua WHERE usuario_id = ?1 AND fecha = ?2').bind(usuarioId, fecha),
    env.DB.prepare('SELECT peso FROM historico_peso WHERE usuario_id = ?1 AND fecha = ?2').bind(usuarioId, fecha),
    env.DB.prepare('SELECT DISTINCT fecha FROM diario_comidas WHERE usuario_id = ?1 AND fecha <= ?2 ORDER BY fecha DESC LIMIT 400').bind(usuarioId, fecha),
    env.DB.prepare('SELECT nombre, meta_calorias, meta_proteinas, meta_carbs, meta_grasas, meta_agua_base_ml FROM usuarios WHERE id = ?1').bind(usuarioId),
    env.DB.prepare('SELECT logro_id, desbloqueado_en FROM usuario_logros WHERE usuario_id = ?1').bind(usuarioId),
  ])
  type R = Record<string, any>
  const filas = (x: any) => (x?.results ?? []) as R[]
  const u = filas(usuario)[0] ?? {}
  const planDia = await leerPlanDia(env, usuarioId, fecha)
  const dia = tipoEfectivo(planDia.plan, planDia.manual, fecha)
  let nombresTipo: Partial<Record<TipoComidaDia, string>> = {}
  try { nombresTipo = planDia.plan?.nombres_json ? JSON.parse(planDia.plan.nombres_json) : {} } catch { /* ignora */ }
  const metas = u.meta_calorias != null
    ? ajustarMetas({ calorias: u.meta_calorias, proteinas: u.meta_proteinas ?? 0, carbohidratos: u.meta_carbs ?? 0, grasas: u.meta_grasas ?? 0 }, planDia.plan, dia.tipo)
    : null
  const racha = calcularRacha(filas(fechas).map((r) => r.fecha as string), fecha)
  const defs = new Map(LOGROS.map((l) => [l.id, l]))
  const delDia = filas(logros)
    .filter((r) => { try { return fechaLocal(r.desbloqueado_en) === fecha } catch { return false } })
    .map((r) => defs.get(r.logro_id))
    .filter((l): l is NonNullable<typeof l> => Boolean(l))
  return construirDia({
    fecha,
    filas: filas(comidas) as FilaDia[],
    nombre: u.nombre,
    nombresTipo,
    metaKcal: metas?.calorias,
    metaMacros: metas ? { proteinas: metas.proteinas, carbohidratos: metas.carbohidratos, grasas: metas.grasas } : null,
    aguaMl: filas(agua)[0]?.ml ?? 0,
    metaAguaMl: u.meta_agua_base_ml || 2000,
    pesoKg: filas(peso)[0]?.peso ?? null,
    racha: racha.hoyRegistrado ? racha.actual : 0,
    logros: delDia.map((l) => ({ titulo: l.titulo, icono: l.icono })),
  })
}
