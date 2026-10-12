/**
 * nutrifit-cron — Worker con Cron Trigger (cada 15 min) que envía los recordatorios.
 * Lee la misma D1 que las Pages Functions. Por usuario con recordatorios activos:
 *   · calcula la hora local (su zona), descarta horas de silencio y el máximo diario;
 *   · solo avisa de una comida si aún no está registrada hoy;
 *   · Web Push a sus suscripciones y, si no tiene ninguna y lo pidió, correo (Brevo);
 *   · lunes 9:00, resumen semanal por correo.
 * Idempotente: recordatorios_envios (usuario, fecha, clave) evita duplicados.
 */
import { ahoraEnZona, recordatoriosPendientes, tocaResumen, type PrefRecordatorios } from '../../functions/utils/recordatorios.ts'
import { enviarPush, vapidDeEnv } from '../../functions/utils/webpush.ts'
import { enviarAviso as enviarAvisoBrevo, mensajeRecordatorio, mensajeResumenSemanal } from '../../functions/utils/email.ts'
import { calcularRacha, evaluarLogros, resumenSemanal, sumarDiasISO, type DiaStats } from '../../functions/utils/logros.ts'

export interface Env {
  DB: D1Database
  BREVO_API_KEY?: string
  VAPID_PUBLIC_KEY?: string
  VAPID_PRIVATE_JWK?: string
  VAPID_SUBJECT?: string
  APP_URL?: string
  CRON_SECRET?: string
}

type Fila = PrefRecordatorios & { usuario_id: string; email_usuario: string; nombre: string | null; baja_token: string | null; meta_agua_base_ml: number | null; meta_calorias: number | null }

const URL_APP = 'https://nutri.trujillomingorance.com'

/** Con BREVO_API_KEY propia envía directo; si no, delega en Pages (/api/interno/correo). */
async function enviarAviso(env: Env, para: string, m: { asunto: string; html: string; texto: string }, bajaUrl: string): Promise<boolean> {
  if (env.BREVO_API_KEY) return enviarAvisoBrevo(env as never, para, m, bajaUrl)
  if (!env.CRON_SECRET) return false
  const res = await fetch(`${env.APP_URL || URL_APP}/api/interno/correo`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-cron-secret': env.CRON_SECRET },
    body: JSON.stringify({ para, ...m, bajaUrl }),
  }).catch(() => null)
  return !!res?.ok
}

async function procesar(env: Env, f: Fila, ahoraUtc: Date): Promise<string[]> {
  const ahora = ahoraEnZona(f.zona || 'Europe/Madrid', ahoraUtc)
  const desde = sumarDiasISO(ahora.fecha, -120)
  const [hoyRes, envRes, diasRes, aguaRes, subsRes] = await env.DB.batch([
    env.DB.prepare('SELECT tipo_comida FROM diario_comidas WHERE usuario_id = ?1 AND fecha = ?2').bind(f.usuario_id, ahora.fecha),
    env.DB.prepare('SELECT clave FROM recordatorios_envios WHERE usuario_id = ?1 AND fecha = ?2').bind(f.usuario_id, ahora.fecha),
    env.DB.prepare('SELECT fecha, COUNT(*) AS comidas, SUM(calorias) AS calorias, SUM(proteinas) AS proteinas FROM diario_comidas WHERE usuario_id = ?1 AND fecha >= ?2 GROUP BY fecha').bind(f.usuario_id, desde),
    env.DB.prepare('SELECT ml FROM registro_agua WHERE usuario_id = ?1 AND fecha = ?2').bind(f.usuario_id, ahora.fecha),
    env.DB.prepare('SELECT endpoint_hash, endpoint, p256dh, auth FROM push_suscripciones WHERE usuario_id = ?1').bind(f.usuario_id),
  ])
  const tipos = new Set(((hoyRes?.results ?? []) as { tipo_comida: string }[]).map((r) => r.tipo_comida))
  const enviados = new Set(((envRes?.results ?? []) as { clave: string }[]).map((r) => r.clave))
  const dias = (diasRes?.results ?? []) as { fecha: string; comidas: number; calorias: number; proteinas: number }[]
  const racha = calcularRacha(dias.map((d) => d.fecha), ahora.fecha)
  const metaAgua = f.meta_agua_base_ml || 2000
  const aguaMl = ((aguaRes?.results ?? [])[0] as { ml?: number } | undefined)?.ml ?? 0
  const subs = (subsRes?.results ?? []) as { endpoint_hash: string; endpoint: string; p256dh: string; auth: string }[]
  const v = vapidDeEnv(env)
  const bajaUrl = `${env.APP_URL || URL_APP}/api/recordatorios/baja?t=${f.baja_token ?? ''}`
  const hechos: string[] = []

  const marcar = (clave: string, canal: string) =>
    env.DB.prepare('INSERT OR IGNORE INTO recordatorios_envios (usuario_id, fecha, clave, canal) VALUES (?1, ?2, ?3, ?4)').bind(f.usuario_id, ahora.fecha, clave, canal).run()

  for (const r of recordatoriosPendientes(f, ahora, { tipos, comidas: tipos.size ? dias.find((d) => d.fecha === ahora.fecha)?.comidas ?? 0 : 0, aguaMl, metaAguaMl: metaAgua }, enviados, racha.actual)) {
    // Reserva primero (idempotencia ante dos ejecuciones solapadas).
    const res = await marcar(r.clave, 'pendiente')
    if (!res.meta?.changes) continue
    let canal = 'ninguno'
    if (v && subs.length) {
      for (const s of subs) {
        const st = await enviarPush(s, { titulo: r.titulo, cuerpo: r.cuerpo, url: r.url, etiqueta: r.clave }, v, 2 * 3600).catch(() => 0)
        if (st >= 200 && st < 300) canal = 'push'
        else if (st === 404 || st === 410) await env.DB.prepare('DELETE FROM push_suscripciones WHERE endpoint_hash = ?1').bind(s.endpoint_hash).run()
        else await env.DB.prepare('UPDATE push_suscripciones SET fallos = fallos + 1 WHERE endpoint_hash = ?1').bind(s.endpoint_hash).run()
      }
    }
    if (canal === 'ninguno' && f.email && f.baja_token && r.clave !== 'agua') {
      if (await enviarAviso(env, f.email_usuario, mensajeRecordatorio(r.titulo, r.cuerpo, r.url, bajaUrl), bajaUrl)) canal = 'email'
    }
    await env.DB.prepare('UPDATE recordatorios_envios SET canal = ?4 WHERE usuario_id = ?1 AND fecha = ?2 AND clave = ?3').bind(f.usuario_id, ahora.fecha, r.clave, canal).run()
    hechos.push(`${r.clave}:${canal}`)
  }

  if (tocaResumen(f, ahora, enviados) && f.baja_token) {
    const res = await marcar('resumen', 'email')
    if (res.meta?.changes) {
      // Semana anterior completa (lunes a domingo).
      const hoyResumen = sumarDiasISO(ahora.fecha, -1)
      const st: DiaStats[] = dias.map((d) => ({ fecha: d.fecha, comidas: d.comidas, calorias: d.calorias ?? 0, proteinas: d.proteinas ?? 0, agua_ml: 0, desayunoTemprano: false }))
      const base = { dias: st, fotos: 0, comidasTotales: 0, pesajes: 0, cambioPesoKg: 0, productosCodigoBarras: 0, metaCalorias: f.meta_calorias, metaProteinas: null, metaAguaMl: metaAgua, hoy: hoyResumen }
      const sem = resumenSemanal(base)
      const logrosRes = await env.DB.prepare("SELECT logro_id FROM usuario_logros WHERE usuario_id = ?1 AND desbloqueado_en >= datetime('now', '-7 days')").bind(f.usuario_id).all<{ logro_id: string }>()
      const titulos = new Map(evaluarLogros(base, racha).map((l) => [l.id, l.titulo]))
      const logros = (logrosRes.results ?? []).map((l) => titulos.get(l.logro_id)).filter(Boolean) as string[]
      if (sem.diasRegistrados > 0 || racha.mejor > 0) {
        await enviarAviso(env, f.email_usuario, mensajeResumenSemanal(f.nombre, { ...sem, racha: racha.actual, logros }, bajaUrl), bajaUrl)
        hechos.push('resumen:email')
      }
    }
  }
  return hechos
}

export async function ejecutar(env: Env, ahora = new Date()): Promise<{ usuarios: number; envios: string[] }> {
  const filas = ((await env.DB.prepare(
    `SELECT r.*, u.email AS email_usuario, u.nombre, u.meta_agua_base_ml, u.meta_calorias
     FROM recordatorios_pref r JOIN usuarios u ON u.id = r.usuario_id
     WHERE r.activo = 1 OR r.resumen_semanal = 1`,
  ).all<Fila>()).results ?? [])
  const envios: string[] = []
  for (const f of filas) {
    try {
      envios.push(...(await procesar(env, f, ahora)).map((x) => `${f.usuario_id.slice(0, 8)}:${x}`))
    } catch (e) {
      console.error('[cron] usuario', f.usuario_id.slice(0, 8), e instanceof Error ? e.message : e)
    }
  }
  // Limpieza: envíos de hace más de 30 días.
  await env.DB.prepare("DELETE FROM recordatorios_envios WHERE creado_en < datetime('now', '-30 days')").run()
  return { usuarios: filas.length, envios }
}

export default {
  async scheduled(_c: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(ejecutar(env).then((r) => console.log('[cron]', JSON.stringify(r))))
  },
  async fetch(): Promise<Response> {
    return new Response('nutrifit-cron: sin endpoints públicos', { status: 404 })
  },
}
