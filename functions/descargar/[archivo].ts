/**
 * GET|HEAD /descargar/NutriFit.apk (alias: /descargar/NutriFit-latest.apk)
 * Última release de Android servida desde nuestro dominio (ver utils/apk.ts).
 * Cualquier otra ruta bajo /descargar/ sigue a los estáticos/SPA.
 */
import type { Handler } from '../utils/env.ts'
import { servirApk } from '../utils/apk.ts'

const ARCHIVOS = new Set(['NutriFit.apk', 'NutriFit-latest.apk'])

export const onRequest: Handler<'archivo'> = async (ctx) => {
  const archivo = String(ctx.params.archivo ?? '')
  if (!ARCHIVOS.has(archivo)) return ctx.next()
  const metodo = ctx.request.method
  if (metodo !== 'GET' && metodo !== 'HEAD') return new Response('Método no permitido', { status: 405, headers: { allow: 'GET, HEAD' } })
  try {
    const res = await servirApk(ctx, metodo)
    if (res) return res
  } catch (e) {
    console.warn('[apk] error:', e instanceof Error ? e.message : e)
  }
  // Sin GitHub disponible: se manda al usuario a la página de descargas con un aviso.
  return new Response(null, { status: 302, headers: { location: '/descargar?apk=no-disponible', 'cache-control': 'no-store' } })
}
