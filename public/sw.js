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
 */
const VERSION = '__VERSION__'
const PRECACHE = /*__PRECACHE__*/ []
const C_ESTATICO = `nf-estatico-${VERSION}`
const C_PAGINAS = 'nf-paginas'
const C_API = 'nf-api'
const ACTUALES = [C_ESTATICO, C_PAGINAS, C_API]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(C_ESTATICO).then((c) => c.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' })))),
  )
  // No se llama a skipWaiting aquí: la app muestra un aviso "Nueva versión" y
  // el usuario decide cuándo activar (mensaje SKIP_WAITING).
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

const ESTATICO = /^\/(assets|fonts|icons)\/|^\/(logo[\w-]*\.svg|favicon\.(svg|ico)|manifest\.webmanifest)$/

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  if (url.pathname.startsWith('/api/')) {
    if (url.pathname === '/api/comidas/resumen') event.respondWith(redPrimero(req, C_API))
    return
  }
  if (req.mode === 'navigate') {
    event.respondWith(navegacion(event))
    return
  }
  if (ESTATICO.test(url.pathname)) event.respondWith(cachePrimero(req))
})

async function navegacion(event) {
  try {
    const pre = await event.preloadResponse
    const res = pre || (await fetch(event.request))
    if (res.ok) {
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
  const enCache = await caches.match(req, { ignoreSearch: true })
  if (enCache) return enCache
  const res = await fetch(req)
  if (res.ok) {
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
