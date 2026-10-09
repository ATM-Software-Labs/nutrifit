/**
 * Proxy resiliente de Open Food Facts (datos ODbL, millones de productos).
 *
 *   código ─► productos del usuario ─► caché (30 días) ─► OFF v2 (reintentos)
 *   texto  ─► KV (30 días) ─► caché D1/Turso (1 día) ─► search-a-licious (España → mundo) ─► cgi/search.pl
 *
 *  · Al tercero solo le llega el término o el código: nunca datos del usuario.
 *    User-Agent identificativo, como exige OFF.
 *  · Límites GLOBALES (además de los del usuario) para respetar los de OFF:
 *    90 productos/min y 9 búsquedas/min desde toda la app.
 *  · Si OFF falla o se supera el límite se sirve la copia caducada (stale-on-error).
 *  · La caché es opcional: con Turso configurado no toca D1; si no, usa D1.
 */
import type { Env } from './env.ts'
import { HttpError } from './response.ts'
import { limitar } from './rateLimit.ts'
import { aplazarEnTurso, leerCheckpoint, guardarCheckpoint } from './turso.ts'
import { foodQuery, guardarKv, leerKv } from './cacheBusquedaKv.ts'

export const USER_AGENT_OFF = 'NutriFit/1.0 (soporte@trujillomingorance.com)'
const BASE = 'https://world.openfoodfacts.org'
const BUSCADOR = 'https://search.openfoodfacts.org/search'
const CAMPOS = 'code,product_name,product_name_es,brands,nutriments,serving_quantity,product_quantity,product_quantity_unit,quantity'
const CAMPOS_BUSCADOR = 'code,product_name,product_name_es,brands,nutriments,quantity'

const DIA = 86_400
export const TTL = { producto: 30 * DIA, noEncontrado: DIA, busqueda: DIA }
const LIMITE_GLOBAL = { producto: 90, busqueda: 9 }

/** España y Unión Europea. OFF acepta la lista en countries_tags_en. */
export const PAISES_OFF = 'spain,european-union'

/** Marcas de distribución españolas y globales habituales en el lineal de aquí. */
const RE_MARCAS_COMUNES =
  /\b(hacendado|pepsi|mercadona|carrefour|caprabo|eroski|alcampo|consum|lidl|dia|bonpreu|condis|gadis|milbona|danone|activia|nestle|nescafe|colacao|coca cola|cocacola|fanta|sprite|aquarius|bimbo|gullon|pescanova|campofrio|elpozo|tarradellas|pascual|puleva|nocilla|nutella)\b/

export function urlOffMundo(camino: 'v2' | 'cgi', termino: string, campos: string, pageSize: number): string {
  const q = encodeURIComponent(termino)
  const paises = `countries_tags_en=${PAISES_OFF}`
  if (camino === 'v2') {
    return `${BASE}/api/v2/search?search_terms=${q}&${paises}&json=1&page_size=${pageSize}&lc=es&fields=${campos}`
  }
  return `${BASE}/cgi/search.pl?search_terms=${q}&search_simple=1&action=process&json=1&page_size=${pageSize}&${paises}&lc=es&fields=${campos}`
}

/** Término más el filtro de país para search-a-licious (Lucene). */
export function consultaEuropa(termino: string): string {
  return `${termino} (countries_tags:"en:spain" OR countries_tags:"en:european-union")`
}

export interface ProductoOFF {
  codigo: string
  nombre: string
  marca: string | null
  /** Había product_name_es: el nombre no es una ficha extranjera sin traducir. */
  traducido?: boolean
  por100: { calorias: number; proteinas: number; carbohidratos: number; grasas: number }
  extra: { azucares: number | null; saturadas: number | null; fibra: number | null; sal: number | null }
  /** Gramos (o ml) de una ración/unidad según el envase. */
  racion: number | null
  /** Contenido del envase en g o ml. */
  envase: number | null
  unidad: 'g' | 'ml'
  fuente: 'off' | 'propio'
}

type Ctx = { env: Env; waitUntil(p: Promise<unknown>): void }

const crudo = (v: unknown) => {
  const x = typeof v === 'string' ? Number(v.replace(',', '.')) : typeof v === 'number' ? v : NaN
  return Number.isFinite(x) && x >= 0 ? x : null
}
const n = (v: unknown) => {
  const x = crudo(v)
  return x === null ? null : Math.round(x * 10) / 10
}
const n100 = (v: unknown) => {
  const x = n(v)
  return x !== null && x <= 100 ? x : null
}
const limpio = (s: unknown, max: number) => (typeof s === 'string' ? s.replace(/[<>\u0000-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim().slice(0, max) : '')

const A_GRAMOS: Record<string, [number, 'g' | 'ml']> = { g: [1, 'g'], gr: [1, 'g'], grs: [1, 'g'], kg: [1000, 'g'], mg: [0.001, 'g'], ml: [1, 'ml'], cl: [10, 'ml'], dl: [100, 'ml'], l: [1000, 'ml'], lt: [1000, 'ml'] }

/**
 * "2.25 l" → {cantidad: 2250, unidad: 'ml'}; "6 x 125 g" → {cantidad: 125, unidades: 6};
 * "8 unidades envase 193 g" → {cantidad: 193, unidades: 8}.
 */
export function parsearCantidad(texto: string): { cantidad: number; unidad: 'g' | 'ml'; unidades: number | null } | null {
  const t = texto.toLowerCase().replace(',', '.')
  const multi = t.match(/(\d{1,2})\s*[x×]\s*(\d+(?:\.\d+)?)\s*(kg|mg|grs?|g|ml|cl|dl|lt|l)\b/)
  if (multi) {
    const [f, u] = A_GRAMOS[multi[3]!]!
    const c = Number(multi[2]) * f
    return c > 0 && c <= 10_000 ? { cantidad: Math.round(c * 10) / 10, unidad: u, unidades: Number(multi[1]) } : null
  }
  const simples = [...t.matchAll(/(\d+(?:\.\d+)?)\s*(kg|mg|grs?|g|ml|cl|dl|lt|l)\b/g)]
  const m = simples.at(-1)
  if (!m) return null
  const [f, u] = A_GRAMOS[m[2]!]!
  const c = Number(m[1]) * f
  const uds = t.match(/(\d{1,2})\s*(?:unidades|uds?\.?|piezas|raciones|porciones)\b/)
  return c > 0 && c <= 10_000 ? { cantidad: Math.round(c * 10) / 10, unidad: u, unidades: uds ? Number(uds[1]) : null } : null
}

/** Producto crudo de OFF → ProductoOFF (null si no tiene nombre o calorías). */
export function normalizarProducto(p: unknown): ProductoOFF | null {
  const o = (p ?? {}) as Record<string, unknown>
  const nu = (o.nutriments ?? {}) as Record<string, unknown>
  const nombreEs = limpio(o.product_name_es, 100)
  const nombre = nombreEs || limpio(o.product_name, 100)
  let kcal = n(nu['energy-kcal_100g'])
  if (kcal === null) {
    const kj = n(nu['energy-kj_100g'] ?? nu['energy_100g'])
    kcal = kj === null ? null : Math.round((kj / 4.184) * 10) / 10
  }
  if (!nombre || kcal === null || kcal > 950) return null
  const marca = limpio(Array.isArray(o.brands) ? o.brands[0] : typeof o.brands === 'string' ? o.brands.split(',')[0] : '', 60) || null
  const codigo = typeof o.code === 'string' && /^\d{4,14}$/.test(o.code) ? o.code : ''

  const cant = parsearCantidad(limpio(o.quantity, 60)) ?? parsearCantidad(nombre)
  let envase = n(o.product_quantity)
  let unidad: 'g' | 'ml' = o.product_quantity_unit === 'ml' ? 'ml' : cant?.unidad ?? 'g'
  if (!envase && cant) envase = cant.cantidad
  if (envase !== null && (envase < 1 || envase > 10_000)) envase = null
  let racion = n(o.serving_quantity)
  if (!(racion && racion > 0 && racion <= 2000)) racion = null
  if (!racion && cant?.unidades && cant.unidades > 1) racion = Math.round((cant.cantidad / cant.unidades) * 10) / 10 // "8 unidades 193 g" → 24,1 g
  if (racion !== null && racion < 1) racion = null
  if (unidad !== 'ml' && unidad !== 'g') unidad = 'g'

  // La sal se guarda con 2 decimales (0,02 g importa en bebidas); sodio × 2,5 = sal.
  const salCruda = crudo(nu.salt_100g) ?? (crudo(nu.sodium_100g) !== null ? crudo(nu.sodium_100g)! * 2.5 : null)
  const sal = salCruda === null || salCruda > 100 ? null : Math.round(salCruda * 100) / 100
  return {
    codigo,
    nombre,
    marca,
    traducido: nombreEs.length > 0,
    por100: { calorias: kcal, proteinas: n100(nu.proteins_100g) ?? 0, carbohidratos: n100(nu.carbohydrates_100g) ?? 0, grasas: n100(nu.fat_100g) ?? 0 },
    extra: { azucares: n100(nu.sugars_100g), saturadas: n100(nu['saturated-fat_100g']), fibra: n100(nu.fiber_100g), sal },
    racion,
    envase,
    unidad,
    fuente: 'off',
  }
}

// ------------------------------------------------------------- caché D1
interface EntradaCache<T> {
  datos: T
  fresca: boolean
}

async function leerCache<T>(env: Env, clave: string): Promise<EntradaCache<T> | null> {
  try {
    const externa = await leerCheckpoint(env, 'cache_off', clave)
    const ahora = Math.floor(Date.now() / 1000)
    if (externa) return { datos: JSON.parse(externa.datos) as T, fresca: externa.expira_en > ahora }
    if (externa === null) return null
    const fila = await env.DB.prepare('SELECT datos, expira_en FROM cache_off WHERE clave = ?1').bind(clave).first<{ datos: string; expira_en: number }>()
    if (!fila) return null
    return { datos: JSON.parse(fila.datos) as T, fresca: fila.expira_en > ahora }
  } catch {
    return null // tabla aún no creada o JSON corrupto: se ignora la caché
  }
}

function guardarCacheD1(ctx: Ctx, clave: string, json: string, expiraEn: number, ahora: number) {
  return ctx.env.DB.prepare(
    'INSERT INTO cache_off (clave, datos, expira_en, actualizado) VALUES (?1, ?2, ?3, ?4) ON CONFLICT (clave) DO UPDATE SET datos = excluded.datos, expira_en = excluded.expira_en, actualizado = excluded.actualizado',
  )
    .bind(clave, json, expiraEn, ahora)
    .run()
    .then(() => undefined)
}

function guardarCache(ctx: Ctx, clave: string, datos: unknown, ttl: number) {
  const ahora = Math.floor(Date.now() / 1000)
  const json = JSON.stringify(datos)
  const expiraEn = ahora + ttl
  const fila = { clave, datos: json, expiraEn, actualizado: ahora }
  if (aplazarEnTurso(ctx, () => guardarCheckpoint(ctx.env, 'cache_off', fila), () => guardarCacheD1(ctx, clave, json, expiraEn, ahora))) return
  ctx.waitUntil(guardarCacheD1(ctx, clave, json, expiraEn, ahora).catch((e: unknown) => console.warn('[off] caché no guardada:', e instanceof Error ? e.message : e)))
}

// ------------------------------------------------------------- red
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** GET JSON con timeout y reintentos (red, 429 y 5xx). 404 → null. */
export async function pedirJson(url: string, intentos = 2, timeoutMs = 6000, f: typeof fetch = fetch): Promise<unknown> {
  let ultimo: unknown
  for (let i = 0; i < intentos; i++) {
    try {
      const res = await f(url, { headers: { 'User-Agent': USER_AGENT_OFF, accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) })
      if (res.status === 404) return null
      if (res.ok) return await res.json()
      ultimo = new Error(`OFF HTTP ${res.status}`)
      if (res.status < 500 && res.status !== 429) break
    } catch (e) {
      ultimo = e
    }
    if (i < intentos - 1) await espera(350 * (i + 1))
  }
  throw ultimo instanceof Error ? ultimo : new Error('OFF no responde')
}

async function cupoGlobal(env: Env, tipo: 'producto' | 'busqueda'): Promise<boolean> {
  try {
    return (await limitar(env, `off:global:${tipo}`, LIMITE_GLOBAL[tipo], 60)).permitido
  } catch {
    return true
  }
}

/** Cupo global compartido con /api/alimentos/off (90 productos/min, 9 búsquedas/min). */
export async function hayCupoOff(env: Env, tipo: 'producto' | 'busqueda'): Promise<boolean> {
  return cupoGlobal(env, tipo)
}

// ------------------------------------------------------------- API
export async function productoOFF(codigo: string, ctx: Ctx): Promise<ProductoOFF | null> {
  const clave = `p:${codigo}`
  const cache = await leerCache<ProductoOFF | { noEncontrado: true }>(ctx.env, clave)
  const desdeCache = (c: typeof cache) => (c && 'codigo' in c.datos ? c.datos : null)
  if (cache?.fresca) return desdeCache(cache)
  if (!(await cupoGlobal(ctx.env, 'producto'))) {
    if (cache) return desdeCache(cache)
    throw new HttpError(429, 'Hay muchas consultas a Open Food Facts ahora mismo. Inténtalo en un minuto.')
  }
  try {
    const datos = (await pedirJson(`${BASE}/api/v2/product/${codigo}.json?fields=${CAMPOS}&lc=es`)) as { product?: unknown } | null
    const p = datos?.product ? normalizarProducto({ code: codigo, ...(datos.product as object) }) : null
    guardarCache(ctx, clave, p ?? { noEncontrado: true }, p ? TTL.producto : TTL.noEncontrado)
    return p
  } catch (e) {
    if (cache) return desdeCache(cache)
    throw e
  }
}

const sinAcentos = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ')

export function puntosMarca(nombre: string, marca: string | null): number {
  return RE_MARCAS_COMUNES.test(sinAcentos(`${nombre} ${marca ?? ''}`)) ? 3 : 0
}

/**
 * Reordena (estable): primero la coincidencia del texto. A igualdad, la marca
 * habitual en España y el nombre ya traducido van antes que una ficha extranjera.
 */
export function priorizarCoincidencias(lista: ProductoOFF[], termino: string): ProductoOFF[] {
  const ps = sinAcentos(termino).split(' ').filter((w) => w.length >= 2)
  if (!ps.length) return lista
  const puntos = (p: ProductoOFF) => {
    const nombre = ` ${sinAcentos(p.nombre)} `
    const todo = `${nombre} ${sinAcentos(p.marca ?? '')} `
    return ps.reduce((s, w) => s + (nombre.includes(` ${w} `) ? 2 : todo.includes(w) ? 1 : 0), 0)
  }
  const local = (p: ProductoOFF) => puntosMarca(p.nombre, p.marca) + (p.traducido ? 2 : 0)
  return lista
    .map((p, i) => ({ p, i, s: puntos(p), local: local(p) }))
    .sort((a, b) => b.s - a.s || b.local - a.local || a.i - b.i)
    .map((x) => x.p)
}

function deduplicar(lista: (ProductoOFF | null)[], max: number): ProductoOFF[] {
  const vistos = new Set<string>()
  return lista.filter((p): p is ProductoOFF => !!p && !vistos.has(p.codigo || p.nombre) && !!vistos.add(p.codigo || p.nombre)).slice(0, max)
}

async function buscarSearchALicious(termino: string, soloEuropa: boolean): Promise<ProductoOFF[]> {
  const q = soloEuropa ? consultaEuropa(termino) : termino
  const url = `${BUSCADOR}?q=${encodeURIComponent(q)}&langs=es&page_size=24&fields=${CAMPOS_BUSCADOR}&sort_by=-unique_scans_n`
  const datos = (await pedirJson(url, 2, 5000)) as { hits?: unknown[] } | null
  return deduplicar((datos?.hits ?? []).map(normalizarProducto), 12)
}

async function buscarCgi(termino: string): Promise<ProductoOFF[]> {
  const url = urlOffMundo('cgi', termino, CAMPOS, 20)
  const datos = (await pedirJson(url, 1, 8000)) as { products?: unknown[] } | null
  return deduplicar((datos?.products ?? []).map(normalizarProducto), 12)
}

/** Término canónico (caché compartida entre usuarios). */
export const terminoOFF = (q: string) =>
  q
    .toLowerCase()
    .normalize('NFC')
    .replace(/["():^~*?\\[\]{}]/g, ' ') // sin sintaxis Lucene
    .replace(/\s+/g, ' ')
    .trim()

function esListaOff(v: unknown): v is ProductoOFF[] {
  return Array.isArray(v) && v.every((p) => !!p && typeof p === 'object' && typeof (p as ProductoOFF).nombre === 'string' && typeof (p as ProductoOFF).por100?.calorias === 'number')
}

export async function buscarOFF(q: string, ctx: Ctx): Promise<ProductoOFF[]> {
  const termino = terminoOFF(q)
  if (termino.length < 2) return []
  const food_query = foodQuery(termino)
  if (food_query) {
    const enKv = await leerKv(ctx.env, food_query, esListaOff)
    if (enKv) return enKv
  }
  const clave = `q:${termino}`.slice(0, 80)
  const cache = await leerCache<ProductoOFF[]>(ctx.env, clave)
  if (cache?.fresca && Array.isArray(cache.datos)) {
    if (food_query) guardarKv(ctx, food_query, cache.datos)
    return cache.datos
  }
  if (!(await cupoGlobal(ctx.env, 'busqueda'))) {
    if (cache) return cache.datos
    throw new HttpError(429, 'Hay muchas búsquedas en Open Food Facts ahora mismo. Usa la base de alimentos o inténtalo en un minuto.')
  }
  try {
    let res: ProductoOFF[] = []
    try {
      res = await buscarSearchALicious(termino, true)
      if (res.length === 0) res = await buscarSearchALicious(termino, false)
    } catch (e) {
      console.warn('[off] search-a-licious falla, uso cgi:', e instanceof Error ? e.message : e)
      res = await buscarCgi(termino)
    }
    res = priorizarCoincidencias(res, termino)
    if (food_query) guardarKv(ctx, food_query, res)
    guardarCache(ctx, clave, res, TTL.busqueda)
    return res
  } catch (e) {
    if (cache) return cache.datos
    throw e
  }
}
