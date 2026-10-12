/**
 * GET /api/logros — racha, logros (con progreso) y resumen semanal.
 * Desbloquea en D1 de forma idempotente (INSERT OR IGNORE) y devuelve `nuevos`
 * con los logros que aún no se habían notificado (visto = 0), marcándolos como vistos.
 */
import type { Handler } from '../utils/env.ts'
import { json } from '../utils/response.ts'
import { exigirSesion } from '../utils/session.ts'
import { hoy as hoyEn, ZONA_POR_DEFECTO } from '../utils/fechas.ts'
import { canalesDe } from '../utils/recordatorios.ts'
import { enviarPush, vapidDeEnv } from '../utils/webpush.ts'
import { calcularRacha, evaluarLogros, resumenSemanal, type DiaStats } from '../utils/logros.ts'

/** Logro nuevo → centro de notificaciones y push (según los canales del usuario). */
async function avisarLogros(env: Parameters<Handler>[0]['env'], id: string, nuevos: { titulo: string; detalle: string }[]) {
  const pref = await env.DB.prepare('SELECT email, canales_json FROM recordatorios_pref WHERE usuario_id = ?1').bind(id).first<{ email: number; canales_json: string | null }>()
  const c = canalesDe(pref, 'logros')
  const titulo = nuevos.length === 1 ? `Logro desbloqueado: ${nuevos[0]!.titulo}` : `${nuevos.length} logros desbloqueados`
  const cuerpo = nuevos.length === 1 ? nuevos[0]!.detalle : nuevos.map((n) => n.titulo).join(' · ')
  if (c.app) await env.DB.prepare('INSERT INTO notificaciones_app (id, usuario_id, tipo, titulo, cuerpo, url) VALUES (?1, ?2, ?3, ?4, ?5, ?6)').bind(crypto.randomUUID(), id, 'logros', titulo.slice(0, 120), cuerpo.slice(0, 400), '/logros').run()
  const v = vapidDeEnv(env)
  if (!c.push || !v) return
  const subs = (await env.DB.prepare('SELECT endpoint, p256dh, auth FROM push_suscripciones WHERE usuario_id = ?1').bind(id).all<{ endpoint: string; p256dh: string; auth: string }>()).results ?? []
  await Promise.all(subs.map((s) => enviarPush(s, { titulo, cuerpo, url: '/logros', etiqueta: 'logro' }, v, 3600).catch(() => 0)))
}

const horaLocal = (utc: string, zona: string) => {
  const d = new Date(utc.replace(' ', 'T') + (utc.endsWith('Z') ? '' : 'Z'))
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: zona, hour: '2-digit', hourCycle: 'h23' }).format(d))
}

export const onRequestGet: Handler = async ({ env, data, waitUntil }) => {
  const { usuarioId: id } = exigirSesion(data.sesion)
  const zona = ZONA_POR_DEFECTO
  const hoy = hoyEn(zona)
  const [dias, desayunos, agua, peso, fotos, codigos, usuario, ya] = await env.DB.batch([
    env.DB.prepare('SELECT fecha, COUNT(*) AS comidas, SUM(calorias) AS calorias, SUM(proteinas) AS proteinas FROM diario_comidas WHERE usuario_id = ?1 GROUP BY fecha').bind(id),
    env.DB.prepare("SELECT fecha, MIN(creado_en) AS t FROM diario_comidas WHERE usuario_id = ?1 AND tipo_comida = 'desayuno' GROUP BY fecha").bind(id),
    env.DB.prepare('SELECT fecha, ml FROM registro_agua WHERE usuario_id = ?1').bind(id),
    env.DB.prepare('SELECT peso FROM historico_peso WHERE usuario_id = ?1 ORDER BY fecha').bind(id),
    env.DB.prepare("SELECT COUNT(*) AS n FROM diario_comidas WHERE usuario_id = ?1 AND imagen_url IS NOT NULL AND imagen_url <> ''").bind(id),
    env.DB.prepare('SELECT COUNT(*) AS n FROM productos_usuario WHERE usuario_id = ?1 AND codigo IS NOT NULL').bind(id),
    env.DB.prepare('SELECT meta_calorias, meta_proteinas, meta_agua_base_ml FROM usuarios WHERE id = ?1').bind(id),
    env.DB.prepare('SELECT logro_id, desbloqueado_en, visto FROM usuario_logros WHERE usuario_id = ?1').bind(id),
  ])
  type R = Record<string, any>
  const filas = (x: any) => (x?.results ?? []) as R[]
  const mapa = new Map<string, DiaStats>()
  const dia = (f: string) => mapa.get(f) ?? (mapa.set(f, { fecha: f, comidas: 0, calorias: 0, proteinas: 0, agua_ml: 0, desayunoTemprano: false }), mapa.get(f)!)
  for (const r of filas(dias)) Object.assign(dia(r.fecha), { comidas: r.comidas, calorias: r.calorias ?? 0, proteinas: r.proteinas ?? 0 })
  for (const r of filas(agua)) dia(r.fecha).agua_ml = r.ml
  for (const r of filas(desayunos)) if (r.t && horaLocal(r.t, zona) < 9) dia(r.fecha).desayunoTemprano = true
  const pesos = filas(peso).map((r) => r.peso as number)
  const u = filas(usuario)[0] ?? {}
  const est = {
    dias: [...mapa.values()],
    fotos: filas(fotos)[0]?.n ?? 0,
    comidasTotales: filas(dias).reduce((s, r) => s + r.comidas, 0),
    pesajes: pesos.length,
    cambioPesoKg: pesos.length > 1 ? pesos[0]! - pesos[pesos.length - 1]! : 0,
    productosCodigoBarras: filas(codigos)[0]?.n ?? 0,
    metaCalorias: u.meta_calorias ?? null,
    metaProteinas: u.meta_proteinas ?? null,
    metaAguaMl: u.meta_agua_base_ml || 2000,
    hoy,
  }
  const racha = calcularRacha(filas(dias).filter((r) => r.comidas > 0).map((r) => r.fecha), hoy)
  const logros = evaluarLogros(est, racha)
  const previos = new Map(filas(ya).map((r) => [r.logro_id as string, r]))
  const aInsertar = logros.filter((l) => l.desbloqueado && !previos.has(l.id))
  const pendientes = new Set([...aInsertar.map((l) => l.id), ...filas(ya).filter((r) => !r.visto).map((r) => r.logro_id as string)])
  const stmts = [
    ...aInsertar.map((l) => env.DB.prepare('INSERT OR IGNORE INTO usuario_logros (usuario_id, logro_id, visto) VALUES (?1, ?2, 1)').bind(id, l.id)),
    ...(pendientes.size ? [env.DB.prepare('UPDATE usuario_logros SET visto = 1 WHERE usuario_id = ?1 AND visto = 0').bind(id)] : []),
  ]
  if (stmts.length) await env.DB.batch(stmts)
  if (aInsertar.length) waitUntil(avisarLogros(env, id, aInsertar.map((l) => ({ titulo: l.titulo, detalle: l.detalle }))).catch(() => {}))
  const ahora = new Date().toISOString()
  return json({
    racha,
    logros: logros.map((l) => ({ ...l, desbloqueado_en: previos.get(l.id)?.desbloqueado_en ?? (l.desbloqueado ? ahora : null) })),
    nuevos: logros.filter((l) => pendientes.has(l.id)).map((l) => l.id),
    semana: resumenSemanal(est),
  })
}
