/**
 * Enlace público de solo lectura de un día compartido.
 *   GET|HEAD /d/<token>         HTML con Open Graph / Twitter Card (sin JS, sin cookies, noindex)
 *   GET|HEAD /d/<token>/og.png  vista previa 1200×630 (PNG < 300 KB)
 * Sin redirecciones ni autenticación: los rastreadores (WhatsApp, Telegram, Slack, X…) leen 200 directo.
 * Caducado o revocado → 410; token inexistente → 404.
 */
import type { Env, Handler } from '../utils/env.ts'
import { estadoEnlace, leerDia, paginaDia, paginaNoDisponible, TOKEN_RE } from '../utils/compartir.ts'
import { origenPublico } from '../utils/compartirUrl.ts'

interface Fila { datos_json: string; expira_en: string | null; revocado_en: string | null; tiene_og: number }

const ROBOTS = 'noindex, nofollow, noarchive'

function html(cuerpo: string, status: number, cache: string, head: boolean): Response {
  return new Response(head ? null : cuerpo, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': cache, 'X-Robots-Tag': ROBOTS, 'Referrer-Policy': 'no-referrer' },
  })
}

async function ogRespaldo(env: Env, request: Request, head: boolean): Promise<Response> {
  const r = await env.ASSETS.fetch(new Request(new URL('/og/compartir.png', request.url)))
  return new Response(head ? null : r.body, { status: 200, headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600', 'X-Robots-Tag': ROBOTS } })
}

export const onRequest: Handler = async ({ request, env, params, waitUntil }) => {
  const metodo = request.method.toUpperCase()
  if (metodo !== 'GET' && metodo !== 'HEAD') return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } })
  const head = metodo === 'HEAD'
  const partes = Array.isArray(params.ruta) ? params.ruta : [params.ruta ?? '']
  const token = partes[0] ?? ''
  const esOg = partes.length === 2 && partes[1] === 'og.png'
  const origen = origenPublico(env)
  if (!TOKEN_RE.test(token) || partes.length > 2 || (partes.length === 2 && !esOg)) {
    return esOg ? ogRespaldo(env, request, head) : html(paginaNoDisponible(origen, 'inexistente'), 404, 'public, max-age=300', head)
  }

  if (esOg) {
    const f = await env.DB.prepare('SELECT og_png, expira_en, revocado_en FROM dias_compartidos WHERE token = ?1').bind(token).first<{ og_png: ArrayBuffer | number[] | null; expira_en: string | null; revocado_en: string | null }>()
    if (!f || estadoEnlace(f) !== 'activo' || !f.og_png) return ogRespaldo(env, request, head)
    const bytes = f.og_png instanceof ArrayBuffer ? new Uint8Array(f.og_png) : new Uint8Array(f.og_png)
    return new Response(head ? null : bytes, {
      headers: { 'Content-Type': 'image/png', 'Content-Length': String(bytes.byteLength), 'Cache-Control': 'public, max-age=3600', 'X-Robots-Tag': ROBOTS },
    })
  }

  const f = await env.DB.prepare('SELECT datos_json, expira_en, revocado_en, og_png IS NOT NULL AS tiene_og FROM dias_compartidos WHERE token = ?1').bind(token).first<Fila>()
  if (!f) return html(paginaNoDisponible(origen, 'inexistente'), 404, 'public, max-age=300', head)
  const estado = estadoEnlace(f)
  const dia = leerDia(f.datos_json)
  if (estado !== 'activo' || !dia) return html(paginaNoDisponible(origen, estado === 'caducado' ? 'caducado' : 'revocado'), 410, 'no-store', head)
  if (!head) waitUntil(env.DB.prepare('UPDATE dias_compartidos SET visitas = visitas + 1 WHERE token = ?1').bind(token).run().catch(() => undefined))
  const url = `${origen}/d/${token}`
  const imagen = f.tiene_og ? `${url}/og.png` : `${origen}/og/compartir.png`
  // Caché corta: si lo revocan, deja de verse en minutos.
  return html(paginaDia(dia, { url, imagen, origen }), 200, 'public, max-age=120', head)
}
