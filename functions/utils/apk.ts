/**
 * APK de Android servido desde nuestro dominio (sin pasar por github.com en el
 * navegador: en muchos móviles ese enlace abre la app de GitHub en vez de descargar).
 *
 *   1. Se resuelve la ÚLTIMA release con el redirect de
 *      github.com/<repo>/releases/latest/download/NutriFit.apk (sin la API de
 *      GitHub, que limita a 60 peticiones/h por IP y las IPs de Workers se
 *      comparten). Location → …/releases/download/<tag>/NutriFit.apk.
 *   2. Esa resolución (tag, URL y tamaño) se guarda 10 min en la caché del borde:
 *      una release nueva se sirve como mucho 10 min después de publicarse.
 *   3. El binario se cachea por tag (inmutable) y se reenvía en streaming.
 */
export const REPO_APK = 'ATM-Software-Labs/nutrifit'
export const NOMBRE_APK = 'NutriFit.apk'
const UA = 'NutriFit/1.0 (soporte@trujillomingorance.com)'
const TTL_RESOLUCION = 600
const BASE_CACHE = 'https://cache.nutrifit.internal'

export interface ApkResuelto {
  version: string
  url: string
  tamano: number | null
}

type Ctx = { waitUntil(p: Promise<unknown>): void }
const cacheBorde = () => (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default

/** Location del redirect de «latest» → { tag, url } (null si no es la forma esperada). */
export function tagDesdeLocation(location: string | null, repo = REPO_APK): { version: string; url: string } | null {
  if (!location) return null
  let u: URL
  try {
    u = new URL(location, 'https://github.com')
  } catch {
    return null
  }
  if (u.protocol !== 'https:' || u.hostname !== 'github.com') return null
  const m = u.pathname.match(/^\/([\w.-]+\/[\w.-]+)\/releases\/download\/([\w.\-+]{1,40})\/NutriFit\.apk$/)
  if (!m || m[1]!.toLowerCase() !== repo.toLowerCase()) return null
  return { version: decodeURIComponent(m[2]!), url: u.toString() }
}

export async function resolverApk(ctx: Ctx): Promise<ApkResuelto | null> {
  const cache = cacheBorde()
  const clave = new Request(`${BASE_CACHE}/apk-latest`)
  const enCache = await cache?.match(clave)
  if (enCache) return (await enCache.json()) as ApkResuelto

  const r = await fetch(`https://github.com/${REPO_APK}/releases/latest/download/${NOMBRE_APK}`, {
    method: 'HEAD',
    redirect: 'manual',
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(5000),
  })
  const destino = tagDesdeLocation(r.headers.get('location'))
  if (!destino) {
    console.warn('[apk] no se pudo resolver la última release', r.status)
    return null
  }
  let tamano: number | null = null
  try {
    const h = await fetch(destino.url, { method: 'HEAD', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(5000) })
    const n = Number(h.headers.get('content-length'))
    if (h.ok && Number.isFinite(n) && n > 0) tamano = n
  } catch {
    /* el tamaño es opcional */
  }
  const datos: ApkResuelto = { ...destino, tamano }
  if (cache) ctx.waitUntil(cache.put(clave, new Response(JSON.stringify(datos), { headers: { 'cache-control': `public, max-age=${TTL_RESOLUCION}` } })))
  return datos
}

export function cabecerasApk(version: string, tamano: number | null): Headers {
  const h = new Headers({
    'content-type': 'application/vnd.android.package-archive',
    'content-disposition': `attachment; filename="${NOMBRE_APK}"`,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'x-nutrifit-version': version,
  })
  if (tamano) h.set('content-length', String(tamano))
  return h
}

/** Respuesta con el APK (streaming). La copia por tag se guarda en la caché del borde. */
export async function servirApk(ctx: Ctx, metodo: 'GET' | 'HEAD'): Promise<Response | null> {
  const apk = await resolverApk(ctx)
  if (!apk) return null
  if (metodo === 'HEAD') return new Response(null, { headers: cabecerasApk(apk.version, apk.tamano) })

  const cache = cacheBorde()
  const clave = new Request(`${BASE_CACHE}/apk/${encodeURIComponent(apk.version)}`)
  let origen = await cache?.match(clave)
  if (!origen) {
    const res = await fetch(apk.url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30_000) })
    if (!res.ok || !res.body) {
      console.warn('[apk] descarga desde GitHub fallida', res.status)
      return null
    }
    const n = Number(res.headers.get('content-length'))
    const tamano = Number.isFinite(n) && n > 0 ? n : apk.tamano
    if (cache) {
      const [a, b] = res.body.tee()
      const h = cabecerasApk(apk.version, tamano)
      h.set('cache-control', 'public, max-age=2592000, immutable') // solo para la caché interna (clave por tag)
      ctx.waitUntil(cache.put(clave, new Response(b, { headers: h })))
      return new Response(a, { headers: cabecerasApk(apk.version, tamano) })
    }
    return new Response(res.body, { headers: cabecerasApk(apk.version, tamano) })
  }
  const n = Number(origen.headers.get('content-length'))
  return new Response(origen.body, { headers: cabecerasApk(apk.version, Number.isFinite(n) && n > 0 ? n : apk.tamano) })
}
