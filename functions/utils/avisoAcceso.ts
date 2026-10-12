/**
 * Aviso de seguridad cuando se inicia sesión desde un navegador/dispositivo nuevo.
 * El primer acceso de la cuenta no avisa (no hay nada con qué comparar).
 */
import type { Env } from './env.ts'
import { enviarAviso, mensajeRecordatorio } from './email.ts'
import { canalesDe } from './recordatorios.ts'

export function describirDispositivo(ua: string): string {
  const so = /Android/i.test(ua) ? 'Android' : /iPhone|iPad/i.test(ua) ? 'iOS' : /Windows/i.test(ua) ? 'Windows' : /Mac OS X|Macintosh/i.test(ua) ? 'macOS' : /Linux/i.test(ua) ? 'Linux' : 'otro sistema'
  const nav = /NutriFitApp|wv\)/i.test(ua) ? 'app NutriFit' : /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'navegador'
  return `${nav} en ${so}`
}

export async function avisarAccesoNuevo(env: Env, request: Request, usuarioId: string, email: string): Promise<void> {
  try {
    const ua = request.headers.get('user-agent') ?? ''
    const pais = (request as { cf?: { country?: string } }).cf?.country ?? request.headers.get('cf-ipcountry') ?? '??'
    const desc = describirDispositivo(ua)
    const huella = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${desc}|${pais}`)))].map((b) => b.toString(16).padStart(2, '0')).join('')
    const previos = await env.DB.prepare('SELECT COUNT(*) AS n FROM accesos_conocidos WHERE usuario_id = ?1').bind(usuarioId).first<{ n: number }>()
    const r = await env.DB.prepare('INSERT OR IGNORE INTO accesos_conocidos (usuario_id, huella, descripcion) VALUES (?1, ?2, ?3)').bind(usuarioId, huella, `${desc} · ${pais}`).run()
    if (!r.meta?.changes || !previos?.n) {
      await env.DB.prepare('UPDATE accesos_conocidos SET visto_en = CURRENT_TIMESTAMP WHERE usuario_id = ?1 AND huella = ?2').bind(usuarioId, huella).run()
      return
    }
    const pref = await env.DB.prepare('SELECT email, canales_json, baja_token FROM recordatorios_pref WHERE usuario_id = ?1').bind(usuarioId).first<{ email: number; canales_json: string | null; baja_token: string | null }>()
    const c = canalesDe(pref, 'seguridad')
    const cuando = new Intl.DateTimeFormat('es-ES', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Madrid' }).format(new Date())
    const titulo = 'Nuevo inicio de sesión en tu cuenta'
    const cuerpo = `Se ha iniciado sesión con ${desc} (${pais}) el ${cuando} (hora de Madrid). Si has sido tú, no tienes que hacer nada. Si no, entra en Ajustes y pulsa «Cerrar sesión en todos los dispositivos».`
    if (c.app) await env.DB.prepare('INSERT INTO notificaciones_app (id, usuario_id, tipo, titulo, cuerpo, url) VALUES (?1, ?2, ?3, ?4, ?5, ?6)').bind(crypto.randomUUID(), usuarioId, 'seguridad', titulo, cuerpo.slice(0, 400), '/ajustes#cuenta').run()
    if (c.email) {
      const baja = `https://nutri.trujillomingorance.com/api/recordatorios/baja?t=${pref?.baja_token ?? ''}`
      const m = mensajeRecordatorio(titulo, cuerpo, '/ajustes#cuenta', baja)
      await enviarAviso(env, email, { ...m, asunto: `${titulo} · NutriFit` }, baja)
    }
  } catch (e) {
    console.warn('[acceso] no se pudo avisar', e instanceof Error ? e.message : e)
  }
}
