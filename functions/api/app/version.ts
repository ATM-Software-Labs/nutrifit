/**
 * GET /api/app/version — versión y tamaño del último APK (público, sin sesión).
 * Usa la misma resolución que /descargar/NutriFit.apk (caché de 10 min).
 * Si GitHub no responde: { ok: true, version: null, … } y el botón sigue funcionando.
 */
import type { Handler } from '../../utils/env.ts'
import { json } from '../../utils/response.ts'
import { resolverApk } from '../../utils/apk.ts'

export const URL_APK_PUBLICA = 'https://nutri.trujillomingorance.com/descargar/NutriFit.apk'

export const onRequestGet: Handler = async (ctx) => {
  try {
    const apk = await resolverApk(ctx)
    if (apk) return json({ ok: true, version: apk.version, tamano: apk.tamano, url: URL_APK_PUBLICA }, { headers: { 'cache-control': 'public, max-age=600' } })
  } catch (e) {
    console.warn('[app/version] GitHub no responde:', e instanceof Error ? e.message : e)
  }
  return json({ ok: true, version: null, tamano: null, url: URL_APK_PUBLICA })
}
