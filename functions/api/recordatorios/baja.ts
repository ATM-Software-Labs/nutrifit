/**
 * GET/POST /api/recordatorios/baja?t=… — baja en un clic de los correos de recordatorio
 * y resumen (List-Unsubscribe-Post, RFC 8058). No necesita sesión: el token es la credencial.
 */
import type { Handler } from '../../utils/env.ts'

async function baja(env: Parameters<Handler>[0]['env'], url: string): Promise<boolean> {
  const t = new URL(url).searchParams.get('t') ?? ''
  if (!/^[a-f0-9]{64}$/.test(t)) return false
  const r = await env.DB.prepare('UPDATE recordatorios_pref SET email = 0, resumen_semanal = 0, actualizado_en = CURRENT_TIMESTAMP WHERE baja_token = ?1').bind(t).run()
  return (r.meta?.changes ?? 0) > 0
}

const pagina = (ok: boolean) =>
  new Response(
    `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NutriFit · Baja</title>
<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1.5rem;color:#111827">
<h1 style="font-size:1.4rem">${ok ? 'Listo, no recibirás más recordatorios por correo' : 'El enlace de baja no es válido o ya se usó'}</h1>
<p style="color:#4b5563">Puedes cambiarlo cuando quieras en <a style="color:#047857" href="/ajustes#recordatorios">Ajustes → Recordatorios</a>.</p></body></html>`,
    { status: ok ? 200 : 404, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } },
  )

export const onRequestGet: Handler = async ({ request, env }) => pagina(await baja(env, request.url))
export const onRequestPost: Handler = async ({ request, env }) => {
  const ok = await baja(env, request.url)
  return new Response(null, { status: ok ? 200 : 404 })
}
