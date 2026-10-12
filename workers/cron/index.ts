/**
 * nutrifit-cron — Worker con Cron Trigger (cada 15 min) que envía los recordatorios.
 * Lee la misma D1 que las Pages Functions. Por usuario con recordatorios activos:
 *   · calcula la hora local (su zona), descarta horas de silencio y el máximo diario;
 *   · solo avisa de una comida si aún no está registrada hoy;
 *   · Web Push a sus suscripciones y, si no tiene ninguna y lo pidió, correo (Brevo);
 *   · lunes 9:00, resumen semanal por correo.
 * Idempotente: recordatorios_envios (usuario, fecha, clave) evita duplicados.
 */
import { ahoraEnZona, avisosExtra, canalesDe, PREF_POR_DEFECTO, recordatoriosPendientes, tipoDeClave, tocaResumen, type Pendiente, type PrefRecordatorios } from '../../functions/utils/recordatorios.ts'
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

type Fila = PrefRecordatorios & { usuario_id: string; email_usuario: string; nombre: string | null; baja_token: string | null; meta_agua_base_ml: number | null; meta_calorias: number | null; meta_proteinas: number | null; creado_usuario: string }

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

type Sub = { endpoint_hash: string; endpoint: string; p256dh: string; auth: string }

/** Envía un aviso por los canales elegidos para su tipo: push → email (si no hubo push o lo pidió) → centro de la app. */
export async function despachar(env: Env, f: Fila, r: Pendiente, subs: Sub[], v: ReturnType<typeof vapidDeEnv>, bajaUrl: string): Promise<string> {
  const c = canalesDe(f, tipoDeClave(r.clave))
  const usados: string[] = []
  if (c.push && v && subs.length) {
    for (const s of subs) {
      const st = await enviarPush(s, { titulo: r.titulo, cuerpo: r.cuerpo, url: r.url, etiqueta: r.clave }, v, 2 * 3600).catch(() => 0)
      if (st >= 200 && st < 300) { if (!usados.includes('push')) usados.push('push') }
      else if (st === 404 || st === 410) await env.DB.prepare('DELETE FROM push_suscripciones WHERE endpoint_hash = ?1').bind(s.endpoint_hash).run()
      else await env.DB.prepare('UPDATE push_suscripciones SET fallos = fallos + 1 WHERE endpoint_hash = ?1').bind(s.endpoint_hash).run()
    }
  }
  const quiereEmail = c.email || (tipoDeClave(r.clave) === 'comidas' && !!f.email && !usados.includes('push'))
  if (quiereEmail && f.baja_token && r.clave !== 'agua') {
    if (await enviarAviso(env, f.email_usuario, mensajeRecordatorio(r.titulo, r.cuerpo, r.url, bajaUrl), bajaUrl)) usados.push('email')
  }
  if (c.app) {
    await env.DB.prepare('INSERT INTO notificaciones_app (id, usuario_id, tipo, titulo, cuerpo, url) VALUES (?1, ?2, ?3, ?4, ?5, ?6)').bind(crypto.randomUUID(), f.usuario_id, tipoDeClave(r.clave), r.titulo, r.cuerpo, r.url).run()
    usados.push('app')
  }
  return usados.join('+') || 'ninguno'
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

  const hoyFila = dias.find((d) => d.fecha === ahora.fecha)
  const estadoDia = { tipos, comidas: hoyFila?.comidas ?? 0, aguaMl, metaAguaMl: metaAgua }
  const ultimo = dias.map((d) => d.fecha).sort().at(-1) ?? null
  const diasEntre = (a: string, b: string) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86_400_000)
  const semanaRes = await env.DB.prepare('SELECT DISTINCT clave FROM recordatorios_envios WHERE usuario_id = ?1 AND fecha >= ?2').bind(f.usuario_id, sumarDiasISO(ahora.fecha, -7)).all<{ clave: string }>()
  const extra = avisosExtra(f, ahora, estadoDia, enviados, {
    racha: racha.actual,
    calorias: hoyFila?.calorias ?? 0,
    proteinas: hoyFila?.proteinas ?? 0,
    metaCalorias: f.meta_calorias,
    metaProteinas: f.meta_proteinas,
    diasSinRegistro: ultimo ? diasEntre(ultimo, ahora.fecha) : null,
    diasDesdeAlta: diasEntre(f.creado_usuario.slice(0, 10), ahora.fecha),
    enviadosSemana: new Set((semanaRes.results ?? []).map((r) => r.clave)),
  })
  let cupo = Math.max(0, f.max_dia - [...enviados].filter((c) => c !== 'resumen').length)
  for (const r of [...recordatoriosPendientes(f, ahora, estadoDia, enviados, racha.actual), ...extra]) {
    if (cupo <= 0) break
    const res = await marcar(r.clave, 'pendiente')
    if (!res.meta?.changes) continue
    const canal = await despachar(env, f, r, subs, v, bajaUrl)
    await env.DB.prepare('UPDATE recordatorios_envios SET canal = ?4 WHERE usuario_id = ?1 AND fecha = ?2 AND clave = ?3').bind(f.usuario_id, ahora.fecha, r.clave, canal).run()
    if (canal !== 'ninguno') cupo--
    hechos.push(`${r.clave}:${canal}`)
  }

  if (tocaResumen(f, ahora, enviados) && f.baja_token) {
    const res = await marcar('resumen', 'email')
    if (res.meta?.changes) {
      // Semana anterior completa (lunes a domingo).
      const hoyResumen = sumarDiasISO(ahora.fecha, -1)
      const st: DiaStats[] = dias.map((d) => ({ fecha: d.fecha, comidas: d.comidas, calorias: d.calorias ?? 0, proteinas: d.proteinas ?? 0, agua_ml: 0, desayunoTemprano: false }))
      const base = { dias: st, emojisDistintos: 0, comidasTotales: 0, pesajes: 0, cambioPesoKg: 0, productosCodigoBarras: 0, metaCalorias: f.meta_calorias, metaProteinas: null, metaAguaMl: metaAgua, hoy: hoyResumen }
      const sem = resumenSemanal(base)
      const logrosRes = await env.DB.prepare("SELECT logro_id FROM usuario_logros WHERE usuario_id = ?1 AND desbloqueado_en >= datetime('now', '-7 days')").bind(f.usuario_id).all<{ logro_id: string }>()
      const titulos = new Map(evaluarLogros(base, racha).map((l) => [l.id, l.titulo]))
      const logros = (logrosRes.results ?? []).map((l) => titulos.get(l.logro_id)).filter(Boolean) as string[]
      if (sem.diasRegistrados > 0 || racha.mejor > 0) {
        const cr = canalesDe(f, 'resumen')
        if (cr.email) await enviarAviso(env, f.email_usuario, mensajeResumenSemanal(f.nombre, { ...sem, racha: racha.actual, logros }, bajaUrl), bajaUrl)
        const aviso = { clave: 'resumen' as const, titulo: `Tu semana: ${sem.adherenciaPct} % de constancia`, cuerpo: `${sem.diasRegistrados} días registrados, ${sem.diasEnObjetivo} en objetivo y racha de ${racha.actual} días.`, url: '/logros' }
        await despachar(env, { ...f, canales_json: JSON.stringify({ resumen: { ...cr, email: false } }) }, aviso, subs, v, bajaUrl)
        hechos.push('resumen')
      }
    }
  }
  return hechos
}

export async function ejecutar(env: Env, ahora = new Date()): Promise<{ usuarios: number; envios: string[] }> {
  const d = PREF_POR_DEFECTO
  const filas = ((await env.DB.prepare(
    `SELECT u.id AS usuario_id, u.email AS email_usuario, u.nombre, u.meta_agua_base_ml, u.meta_calorias, u.meta_proteinas, u.creado_en AS creado_usuario,
            COALESCE(r.activo, 0) AS activo, COALESCE(r.zona, ?1) AS zona, r.desayuno, r.comida, r.cena, r.snack, COALESCE(r.cierre, ?2) AS cierre,
            COALESCE(r.agua, 0) AS agua, COALESCE(r.email, 0) AS email, COALESCE(r.resumen_semanal, 1) AS resumen_semanal,
            COALESCE(r.silencio_desde, ?3) AS silencio_desde, COALESCE(r.silencio_hasta, ?4) AS silencio_hasta, COALESCE(r.max_dia, ?5) AS max_dia,
            r.baja_token, r.canales_json, (r.usuario_id IS NOT NULL) AS tiene_pref
     FROM usuarios u LEFT JOIN recordatorios_pref r ON r.usuario_id = u.id`,
  ).bind(d.zona, d.cierre, d.silencio_desde, d.silencio_hasta, d.max_dia).all<Fila & { tiene_pref: number }>()).results ?? [])
  // Quien no ha tocado Ajustes recibe aun así avisos de ciclo de vida: necesita token de baja.
  for (const f of filas) {
    if (!f.baja_token) {
      f.baja_token = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, '0')).join('')
      await env.DB.prepare(
        `INSERT INTO recordatorios_pref (usuario_id, baja_token, desayuno, comida, cena, cierre) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT (usuario_id) DO UPDATE SET baja_token = COALESCE(baja_token, ?2)`,
      ).bind(f.usuario_id, f.baja_token, d.desayuno, d.comida, d.cena, d.cierre).run()
      if (!f.tiene_pref) { f.desayuno = d.desayuno; f.comida = d.comida; f.cena = d.cena }
    }
  }
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
