/**
 * Proxy de Open Food Facts (https://world.openfoodfacts.org, datos ODbL).
 *  · Solo se envía el término de búsqueda o el código de barras: nunca datos
 *    del usuario. User-Agent identificativo, como exige OFF.
 *  · Caché en el borde (Cache API): búsquedas 1 día, códigos de barras 7 días.
 *  · Respuesta normalizada a valores por 100 g (kcal, P, C, G).
 */
export const USER_AGENT_OFF = 'NutriFit/1.0 (soporte@trujillomingorance.com)'
const BASE = 'https://world.openfoodfacts.org'
const CAMPOS = 'code,product_name,product_name_es,brands,nutriments,serving_quantity'

export interface ProductoOFF {
  codigo: string
  nombre: string
  marca: string | null
  por100: { calorias: number; proteinas: number; carbohidratos: number; grasas: number }
  racion: number | null
}

const n = (v: unknown) => {
  const x = typeof v === 'string' ? Number(v.replace(',', '.')) : typeof v === 'number' ? v : NaN
  return Number.isFinite(x) && x >= 0 ? Math.round(x * 10) / 10 : null
}
const limpio = (s: unknown, max: number) => (typeof s === 'string' ? s.replace(/[<>\u0000-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim().slice(0, max) : '')

/** Producto crudo de OFF → ProductoOFF (null si no tiene nombre o calorías). */
export function normalizarProducto(p: unknown): ProductoOFF | null {
  const o = (p ?? {}) as Record<string, unknown>
  const nu = (o.nutriments ?? {}) as Record<string, unknown>
  const nombre = limpio(o.product_name_es, 100) || limpio(o.product_name, 100)
  let kcal = n(nu['energy-kcal_100g'])
  if (kcal === null) {
    const kj = n(nu['energy-kj_100g'] ?? nu['energy_100g'])
    kcal = kj === null ? null : Math.round((kj / 4.184) * 10) / 10
  }
  if (!nombre || kcal === null || kcal > 950) return null
  const marca = limpio(Array.isArray(o.brands) ? o.brands[0] : typeof o.brands === 'string' ? o.brands.split(',')[0] : '', 60) || null
  const codigo = typeof o.code === 'string' && /^\d{4,14}$/.test(o.code) ? o.code : ''
  const racion = n(o.serving_quantity)
  return {
    codigo,
    nombre,
    marca,
    por100: { calorias: kcal, proteinas: n(nu.proteins_100g) ?? 0, carbohidratos: n(nu.carbohydrates_100g) ?? 0, grasas: n(nu.fat_100g) ?? 0 },
    racion: racion && racion > 0 && racion <= 2000 ? racion : null,
  }
}

async function pedirConCache(url: string, ttl: number, ctx: { waitUntil(p: Promise<unknown>): void }): Promise<unknown> {
  const cache = (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default
  const clave = new Request(url)
  const enCache = await cache?.match(clave)
  if (enCache) return enCache.json()
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT_OFF, accept: 'application/json' }, signal: AbortSignal.timeout(8000) })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`OFF HTTP ${res.status}`)
  const datos = await res.json()
  if (cache) {
    const copia = new Response(JSON.stringify(datos), { headers: { 'content-type': 'application/json', 'cache-control': `public, max-age=${ttl}` } })
    ctx.waitUntil(cache.put(clave, copia))
  }
  return datos
}

export async function buscarOFF(q: string, ctx: { waitUntil(p: Promise<unknown>): void }): Promise<ProductoOFF[]> {
  const termino = q.toLowerCase().normalize('NFC').replace(/\s+/g, ' ').trim()
  const url = `${BASE}/cgi/search.pl?search_terms=${encodeURIComponent(termino)}&search_simple=1&action=process&json=1&page_size=20&cc=es&lc=es&fields=${CAMPOS}`
  const datos = (await pedirConCache(url, 86_400, ctx)) as { products?: unknown[] } | null
  const vistos = new Set<string>()
  return (datos?.products ?? [])
    .map(normalizarProducto)
    .filter((p): p is ProductoOFF => !!p && !vistos.has(p.codigo || p.nombre) && !!vistos.add(p.codigo || p.nombre))
    .slice(0, 12)
}

export async function productoOFF(codigo: string, ctx: { waitUntil(p: Promise<unknown>): void }): Promise<ProductoOFF | null> {
  const datos = (await pedirConCache(`${BASE}/api/v2/product/${codigo}.json?fields=${CAMPOS}`, 7 * 86_400, ctx)) as { product?: unknown; status?: number } | null
  return datos?.product ? normalizarProducto(datos.product) : null
}
