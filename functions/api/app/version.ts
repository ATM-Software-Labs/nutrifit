/**
 * GET /api/app/version — última versión publicada del APK (pública, sin sesión).
 * Lee la release "latest" de GitHub y la guarda 1 h en la caché del borde, así
 * que GitHub recibe como mucho una petición por hora y colo. Si falla, devuelve
 * { ok: true, version: null } y el botón de descarga sigue funcionando sin datos.
 */
import type { Handler } from '../../utils/env.ts'
import { json } from '../../utils/response.ts'

const REPO = 'ATM-Software-Labs/nutrifit'
const TTL = 3600

interface Release {
  tag_name?: string
  published_at?: string
  assets?: { name?: string; size?: number }[]
}

export function resumirRelease(r: Release | null): { version: string | null; tamano: number | null; fecha: string | null } {
  const apk = r?.assets?.find((a) => a.name === 'NutriFit.apk')
  const version = typeof r?.tag_name === 'string' && /^v?\d+(\.\d+){0,3}[\w.-]{0,20}$/.test(r.tag_name) ? r.tag_name : null
  return {
    version,
    tamano: typeof apk?.size === 'number' && apk.size > 0 ? apk.size : null,
    fecha: typeof r?.published_at === 'string' ? r.published_at.slice(0, 10) : null,
  }
}

export const onRequestGet: Handler = async (ctx) => {
  const cache = (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default
  const clave = new Request(`https://cache.nutrifit.internal/app-version`)
  const enCache = await cache?.match(clave)
  if (enCache) return json(await enCache.json(), { headers: { 'cache-control': `public, max-age=${TTL}` } })
  let datos = { ok: true, version: null as string | null, tamano: null as number | null, fecha: null as string | null }
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { 'User-Agent': 'NutriFit/1.0 (soporte@trujillomingorance.com)', accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(4000),
    })
    if (res.ok) {
      datos = { ok: true, ...resumirRelease((await res.json()) as Release) }
      if (cache) ctx.waitUntil(cache.put(clave, new Response(JSON.stringify(datos), { headers: { 'cache-control': `public, max-age=${TTL}` } })))
    }
  } catch (e) {
    console.warn('[app/version] GitHub no responde:', e instanceof Error ? e.message : e)
  }
  return json(datos, { headers: { 'cache-control': datos.version ? `public, max-age=${TTL}` : 'no-store' } })
}
