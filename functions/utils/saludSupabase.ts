/**
 * Salud de Supabase (base secundaria) y latido anti-pausa.
 * La ronda del cron (GitHub Actions, cada 15 min) llama a vigilarSupabase():
 *   · nf_latido(): una lectura y una escritura reales en Postgres → el proyecto
 *     cuenta con actividad y el plan gratuito no lo pausa por inactividad;
 *   · guarda el estado en D1 (estado_servicios) para /api/health y Ajustes;
 *   · si lleva caído más de 30 min, avisa por correo a ALERTAS_EMAIL una vez por
 *     caída (y otra al recuperarse). Si está pausado, el aviso lo dice y enlaza al panel.
 */
import type { MensajeCorreo } from './email.ts'
import { supaFetch, supabaseConfigurado, type SupaEnv } from './supabase.ts'

export type EstadoSupabase = 'ok' | 'caido' | 'pausado' | 'sin_config'

export interface Comprobacion {
  estado: EstadoSupabase
  error?: string
  latido?: { visto_en: string; n: number; alimentos: number; comidas: number; filas_copia: number }
}

export const MINUTOS_ALERTA = 30

export function refProyecto(url?: string): string | null {
  return url?.match(/^https:\/\/([a-z0-9]{20})\.supabase\.co/)?.[1] ?? null
}

export const urlPanel = (url?: string) => {
  const ref = refProyecto(url)
  return ref ? `https://supabase.com/dashboard/project/${ref}` : 'https://supabase.com/dashboard/projects'
}

/** Un proyecto pausado responde 540 o un texto que lo dice. */
export function pareceEnPausa(mensaje: string): boolean {
  return /Supabase 540\b|paused|pausad|project is (inactive|not active)|restoring/i.test(mensaje)
}

export async function comprobarSupabase(env: SupaEnv, timeoutMs = 4000): Promise<Comprobacion> {
  if (!supabaseConfigurado(env)) return { estado: 'sin_config' }
  try {
    const res = await supaFetch(env, 'rpc/nf_latido', { method: 'POST', body: JSON.stringify({ p_origen: 'cron' }), timeoutMs })
    const filas = (await res.json()) as Comprobacion['latido'][]
    return { estado: 'ok', latido: Array.isArray(filas) ? filas[0] : undefined }
  } catch (e) {
    const error = (e instanceof Error ? e.message : String(e)).slice(0, 300)
    return { estado: pareceEnPausa(error) ? 'pausado' : 'caido', error }
  }
}

interface FilaEstado {
  estado: EstadoSupabase
  caido_desde: number | null
  ultimo_ok: number | null
  alertado_en: number | null
  ultimo_error: string | null
  comprobado_en: number
}

export async function leerEstadoSupabase(db: D1Database): Promise<FilaEstado | null> {
  try {
    return await db.prepare("SELECT estado, caido_desde, ultimo_ok, alertado_en, ultimo_error, comprobado_en FROM estado_servicios WHERE servicio = 'supabase'").first<FilaEstado>()
  } catch {
    return null // migración 0015 aún no aplicada
  }
}

export type Alerta = { tipo: 'caida' | 'recuperado'; mensaje: MensajeCorreo } | null

/** Decide el nuevo estado y si toca avisar (función pura, testeable). */
export function transicion(previo: FilaEstado | null, c: Comprobacion, ahora: number, url?: string): { fila: FilaEstado; alerta: { tipo: 'caida' | 'recuperado'; titulo: string; cuerpo: string; boton: string; url: string } | null } {
  const panel = urlPanel(url)
  if (c.estado === 'ok' || c.estado === 'sin_config') {
    const alerta =
      c.estado === 'ok' && previo?.alertado_en
        ? { tipo: 'recuperado' as const, titulo: 'Supabase vuelve a funcionar', cuerpo: `La base secundaria de NutriFit responde de nuevo. Estuvo sin servicio desde ${new Date((previo.caido_desde ?? ahora) * 1000).toISOString()}.\nEl catálogo y la copia diaria vuelven a estar activos.`, boton: 'Abrir el panel de Supabase', url: panel }
        : null
    return { fila: { estado: c.estado, caido_desde: null, ultimo_ok: c.estado === 'ok' ? ahora : (previo?.ultimo_ok ?? null), alertado_en: null, ultimo_error: null, comprobado_en: ahora }, alerta }
  }
  const caidoDesde = previo && previo.estado !== 'ok' && previo.estado !== 'sin_config' && previo.caido_desde ? previo.caido_desde : ahora
  const minutos = Math.floor((ahora - caidoDesde) / 60)
  const debeAvisar = !previo?.alertado_en && (minutos >= MINUTOS_ALERTA || c.estado === 'pausado')
  const pausado = c.estado === 'pausado'
  const alerta = debeAvisar
    ? {
        tipo: 'caida' as const,
        titulo: pausado ? 'Supabase está en pausa' : 'Supabase no responde',
        cuerpo: pausado
          ? `El proyecto de Supabase de NutriFit está pausado. La app sigue funcionando con D1, Open Food Facts, USDA y la IA, pero sin catálogo compartido ni copia diaria.\nPara reactivarlo, entra en el panel y pulsa «Restore project» (se puede hasta 90 días después de la pausa).\nError: ${c.error ?? '—'}`
          : `La base secundaria de NutriFit lleva ${minutos} minutos sin responder. La app sigue funcionando con D1, Open Food Facts, USDA y la IA (precisión reducida en el análisis de fotos).\nError: ${c.error ?? '—'}`,
        boton: pausado ? 'Reactivar en Supabase' : 'Ver el estado en Supabase',
        url: panel,
      }
    : null
  return { fila: { estado: c.estado, caido_desde: caidoDesde, ultimo_ok: previo?.ultimo_ok ?? null, alertado_en: debeAvisar ? ahora : (previo?.alertado_en ?? null), ultimo_error: c.error ?? null, comprobado_en: ahora }, alerta }
}

export async function guardarEstadoSupabase(db: D1Database, f: FilaEstado): Promise<void> {
  await db
    .prepare(
      `INSERT INTO estado_servicios (servicio, estado, caido_desde, ultimo_ok, ultimo_error, alertado_en, comprobado_en) VALUES ('supabase', ?1, ?2, ?3, ?4, ?5, ?6)
       ON CONFLICT (servicio) DO UPDATE SET estado = excluded.estado, caido_desde = excluded.caido_desde, ultimo_ok = excluded.ultimo_ok,
         ultimo_error = excluded.ultimo_error, alertado_en = excluded.alertado_en, comprobado_en = excluded.comprobado_en`,
    )
    .bind(f.estado, f.caido_desde, f.ultimo_ok, f.ultimo_error, f.alertado_en, f.comprobado_en)
    .run()
}

export interface EnvVigilancia extends SupaEnv {
  DB: D1Database
  ALERTAS_EMAIL?: string
}

/** Latido + estado + alerta. enviar() se inyecta para no acoplar este módulo a Brevo. */
export async function vigilarSupabase(env: EnvVigilancia, enviar: (para: string, m: MensajeCorreo) => Promise<boolean>, crearMensaje: (titulo: string, cuerpo: string, url: string, boton: string) => MensajeCorreo) {
  const c = await comprobarSupabase(env)
  const ahora = Math.floor(Date.now() / 1000)
  const previo = await leerEstadoSupabase(env.DB)
  const { fila, alerta } = transicion(previo, c, ahora, env.SUPABASE_URL)
  let avisado = false
  if (alerta) {
    console.warn(`[supabase] ${alerta.titulo}: ${c.error ?? 'ok'}`)
    if (env.ALERTAS_EMAIL) avisado = await enviar(env.ALERTAS_EMAIL, crearMensaje(alerta.titulo, alerta.cuerpo, alerta.url, alerta.boton)).catch(() => false)
    // Si el correo falla, se reintenta en la siguiente ronda.
    if (!avisado && alerta.tipo === 'caida') fila.alertado_en = null
    if (!avisado && alerta.tipo === 'recuperado') fila.alertado_en = previo?.alertado_en ?? null
  } else if (c.estado !== 'ok' && c.estado !== 'sin_config') {
    console.warn(`[supabase] ${c.estado}: ${c.error}`)
  }
  await guardarEstadoSupabase(env.DB, fila).catch((e: unknown) => console.warn('[supabase] estado no guardado:', e instanceof Error ? e.message : e))
  return { estado: c.estado, latido: c.latido ?? null, alerta: alerta?.tipo ?? null, avisado }
}
