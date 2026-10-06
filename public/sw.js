/* NutriFit · Service Worker escrito a mano (sin Workbox).
 * La lista de precarga y la versión las inyecta el plugin `nutrifitSW` de
 * vite.config.ts al compilar (en desarrollo no se registra).
 *
 * Estrategias:
 *  · Navegación (HTML)              → network-first; sin red → shell /index.html precacheado.
 *  · /assets (hash), /fonts, /icons,
 *    logos y favicon                → cache-first (inmutables o casi).
 *  · /api/comidas/resumen (GET)     → network-first con copia para ver el día sin conexión.
 *  · Resto de /api                  → nunca se cachea (pasa directo a la red).
 *
 * Actualización: cada versión se activa sola (skipWaiting + clients.claim) y
 * borra las cachés anteriores. Nunca se guarda en caché un recurso estático que
 * no sea válido (status ≠ 200 o JS/CSS servido como HTML por el fallback SPA):
 * así un despliegue a medias no puede «envenenar» la app con una pantalla blanca.
 */
const VERSION = '__VERSION__'
const PRECACHE = /*__PRECACHE__*/ []
const C_ESTATICO = `nf-estatico-${VERSION}`
const C_PAGINAS = `nf-paginas-${VERSION}`
const C_API = 'nf-api'
const ACTUALES = [C_ESTATICO, C_PAGINAS, C_API]

/** ¿La respuesta sirve para ese recurso? (descarta 404 y el index.html del fallback SPA). */
function valida(url, res) {
  if (!res || res.status !== 200 || res.type === 'opaque') return false
  const tipo = (res.headers.get('content-type') || '').toLowerCase()
  if (/\.m?js$/.test(url.pathname)) return tipo.includes('javascript')
  if (/\.css$/.test(url.pathname)) return tipo.includes('text/css')
  if (url.pathname === '/index.html') return tipo.includes('text/html')
  return !tipo.includes('text/html')
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(C_ESTATICO)
      await Promise.all(
        PRECACHE.map(async (u) => {
          const url = new URL(u, self.location.origin)
          // /index.html redirige (308) a «/» en Pages: se descarga «/» y se guarda como /index.html.
          const res = await fetch(new Request(u === '/index.html' ? '/' : u, { cache: 'reload' }))
          // Si el despliegue aún no está completo, la instalación falla y se reintenta luego.
          if (!valida(url, res)) throw new Error(`[sw] precarga inválida: ${u} (${res.status})`)
          await cache.put(u, res)
        }),
      )
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const nombre of await caches.keys()) {
        if (nombre.startsWith('nf-') && !ACTUALES.includes(nombre)) await caches.delete(nombre)
      }
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable()
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('message', (event) => {
  const tipo = event.data && event.data.tipo
  if (tipo === 'SKIP_WAITING') self.skipWaiting()
  // Al cerrar sesión: borra datos personales cacheados (resúmenes y HTML).
  if (tipo === 'LIMPIAR_DATOS') event.waitUntil(Promise.all([caches.delete(C_API), caches.delete(C_PAGINAS)]))
})

const ESTATICO = /^\/(assets|fonts|icons)\/|^\/(logo[\w-]*\.svg|favicon\.(svg|ico)|manifest\.webmanifest|boot\.js)$/

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  if (url.pathname.startsWith('/api/')) {
    if (url.pathname === '/api/comidas/resumen') event.respondWith(redPrimero(req, C_API))
    return
  }
  // /app-login lleva el token del magic link: que lo gestione solo la red.
  if (url.pathname.startsWith('/app-login')) return
  // El APK (/descargar/NutriFit.apk) siempre de la red, sin tocarlo.
  if (url.pathname.startsWith('/descargar/')) return
  if (req.mode === 'navigate') {
    event.respondWith(navegacion(event, url))
    return
  }
  if (ESTATICO.test(url.pathname)) event.respondWith(cachePrimero(req))
})

async function navegacion(event, url) {
  try {
    const pre = await event.preloadResponse
    const res = pre || (await fetch(event.request))
    // Solo la raíz alimenta el shell offline (todas las rutas de la SPA sirven el mismo HTML).
    if (res.ok && url.pathname === '/') {
      const copia = res.clone()
      caches.open(C_PAGINAS).then((c) => c.put('/index.html', copia))
    }
    return res
  } catch {
    return (
      (await caches.match('/index.html', { cacheName: C_PAGINAS })) ||
      (await caches.match('/index.html')) ||
      new Response('<h1>Sin conexión</h1>', { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
    )
  }
}

async function cachePrimero(req) {
  const url = new URL(req.url)
  const enCache = await caches.match(req, { ignoreSearch: true })
  if (enCache && valida(url, enCache)) return enCache
  let res = await fetch(req)
  // Respuesta no válida (p. ej. una copia mala en la caché HTTP): una vez más, saltándose la caché.
  if (!valida(url, res)) res = await fetch(req.url, { cache: 'reload', credentials: 'same-origin' })
  if (valida(url, res)) {
    const copia = res.clone()
    caches.open(C_ESTATICO).then((c) => c.put(req, copia))
  }
  return res
}

async function redPrimero(req, nombreCache) {
  const cache = await caches.open(nombreCache)
  try {
    const res = await fetch(req)
    if (res.ok) cache.put(req, res.clone())
    return res
  } catch {
    const enCache = await cache.match(req)
    if (enCache) return enCache
    return new Response(JSON.stringify({ error: 'Sin conexión' }), { status: 503, headers: { 'Content-Type': 'application/json' } })
  }
}
