/**
 * Catálogo de alimentos de NutriFit:
 *   código de barras → Open Food Facts v2 (prioriza Mercadona/Hacendado,
 *   Carrefour, Caprabo, Eroski, Dia y Lidl);
 *   texto → búsqueda en España y, si es un fresco, ficha BEDCA.
 *
 * Cada acierto se guarda 30 días. Primero en KV (edge); si no hay binding,
 * en Turso o en catalogo_alimentos_cache. La caché solo guarda composición
 * pública, nunca datos del usuario.
 */
import type { Env } from './env.ts'
import { HttpError } from './response.ts'
import { hayCupoOff, parsearCantidad, pedirJson, terminoOFF } from './off.ts'
import { foodQuery, guardarKv, leerKv } from './cacheBusquedaKv.ts'
import { aplazarEnTurso, guardarCheckpoint, leerCheckpoint } from './turso.ts'
import { buscarFrescoBedca, esConsultaFresco, type Nutrientes } from './bedca.ts'

export type { Nutrientes }

const BASE = 'https://world.openfoodfacts.org'
const DIA = 86_400
export const TTL_CATALOGO_S = 30 * DIA
const CAMPOS = 'code,product_name,product_name_es,brands,brands_tags,stores,stores_tags,nutriments,serving_quantity,serving_size,product_quantity,product_quantity_unit,quantity'

export const CADENAS = [
  { id: 'mercadona', alias: ['mercadona', 'hacendado'] },
  { id: 'carrefour', alias: ['carrefour'] },
  { id: 'caprabo', alias: ['caprabo'] },
  { id: 'eroski', alias: ['eroski'] },
  { id: 'dia', alias: ['dia'] },
  { id: 'lidl', alias: ['lidl'] },
] as const

export type CadenaId = (typeof CADENAS)[number]['id']

export interface AlimentoCatalogo {
  id: string
  codigo: string | null
  nombre: string
  marca: string | null
  /** Cadenas españolas detectadas, de mayor a menor prioridad. */
  cadenas: CadenaId[]
  cadena_prioritaria: CadenaId | null
  unidad: 'g' | 'ml'
  por_100g: Nutrientes
  por_porcion: Nutrientes | null
  gramos_porcion: number | null
  fuente: 'off' | 'bedca' | 'propio'
}

type Ctx = { env: Env; waitUntil(p: Promise<unknown>): void }

const sinAcentos = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

const crudo = (v: unknown): number | null => {
  const x = typeof v === 'string' ? Number(v.replace(',', '.')) : typeof v === 'number' ? v : NaN
  return Number.isFinite(x) && x >= 0 ? x : null
}

const limpio = (s: unknown, max: number) => (typeof s === 'string' ? s.replace(/[<>\u0000-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim().slice(0, max) : '')

const DEC: Record<keyof Nutrientes, number> = {
  energia_kcal: 1,
  proteinas: 1,
  carbohidratos: 1,
  azucares: 1,
  grasas: 1,
  grasas_saturadas: 1,
  fibra: 1,
  sal: 2,
}

function redondear(v: number, dec: number): number {
  const f = 10 ** dec
  return Math.round(v * f) / f
}

/** Acota un nutriente ya en base 100 g. Fuera de rango fisiológico → null. */
export function cerrarNutrientes(n: Nutrientes): Nutrientes {
  const uno = (clave: keyof Nutrientes, max: number): number | null => {
    const v = n[clave]
    if (v === null || !Number.isFinite(v) || v < 0 || v > max) return null
    return redondear(v, DEC[clave])
  }
  let energia = uno('energia_kcal', 950)
  const proteinas = uno('proteinas', 100)
  const carbohidratos = uno('carbohidratos', 100)
  const grasas = uno('grasas', 100)
  if (energia === null && (proteinas !== null || carbohidratos !== null || grasas !== null)) {
    const kcal = (proteinas ?? 0) * 4 + (carbohidratos ?? 0) * 4 + (grasas ?? 0) * 9
    if (kcal <= 950) energia = redondear(kcal, 1)
  }
  return {
    energia_kcal: energia,
    proteinas,
    carbohidratos,
    azucares: uno('azucares', 100),
    grasas,
    grasas_saturadas: uno('grasas_saturadas', 100),
    fibra: uno('fibra', 100),
    sal: uno('sal', 100),
  }
}

export function escalarNutrientes(base: Nutrientes, gramos: number): Nutrientes {
  const k = gramos / 100
  const escala = (clave: keyof Nutrientes): number | null => (base[clave] === null ? null : redondear(base[clave]! * k, DEC[clave]))
  return {
    energia_kcal: escala('energia_kcal'),
    proteinas: escala('proteinas'),
    carbohidratos: escala('carbohidratos'),
    azucares: escala('azucares'),
    grasas: escala('grasas'),
    grasas_saturadas: escala('grasas_saturadas'),
    fibra: escala('fibra'),
    sal: escala('sal'),
  }
}

function comoLista(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string')
  if (typeof v === 'string') return v.split(/[,;/|]/)
  return []
}

/** Reconoce es:mercadona, en:carrefour, «Mercadona» o la marca blanca Hacendado. */
export function detectarCadenas(origen: { stores?: unknown; stores_tags?: unknown; brands?: unknown; brands_tags?: unknown }): CadenaId[] {
  const etiquetas = [...comoLista(origen.stores_tags), ...comoLista(origen.brands_tags), ...comoLista(origen.stores), ...comoLista(origen.brands)].map((t) =>
    sinAcentos(t)
      .replace(/^[a-z]{2}:/, '')
      .trim(),
  )
  const palabras = new Set(etiquetas.flatMap((t) => t.split(' ').filter(Boolean)))
  return CADENAS.filter((c) => c.alias.some((a) => palabras.has(a))).map((c) => c.id)
}

function valor100(nu: Record<string, unknown>, claves100: string[], clavesRacion: string[], gramosRacion: number | null): number | null {
  for (const c of claves100) {
    const v = crudo(nu[c])
    if (v !== null) return v
  }
  if (!gramosRacion) return null
  for (const c of clavesRacion) {
    const v = crudo(nu[c])
    if (v !== null) return (v * 100) / gramosRacion
  }
  return null
}

function gramosRacionDe(o: Record<string, unknown>, nombre: string): number | null {
  const directa = crudo(o.serving_quantity)
  if (directa && directa >= 1 && directa <= 2000) return directa
  const texto = limpio(o.serving_size, 40) || limpio(o.quantity, 60) || nombre
  const cant = parsearCantidad(texto)
  if (!cant) return null
  const g = cant.unidades && cant.unidades > 1 ? cant.cantidad / cant.unidades : cant.cantidad
  return g >= 1 && g <= 2000 ? Math.round(g * 10) / 10 : null
}

/** Producto crudo de OFF → valores por 100 g y por la ración del envase. */
export function normalizarProductoOff(p: unknown, codigoForzado?: string): AlimentoCatalogo | null {
  const o = (p ?? {}) as Record<string, unknown>
  const nu = (o.nutriments ?? {}) as Record<string, unknown>
  const nombre = limpio(o.product_name_es, 100) || limpio(o.product_name, 100)
  if (!nombre) return null
  const codigo = codigoForzado && /^\d{8,14}$/.test(codigoForzado) ? codigoForzado : typeof o.code === 'string' && /^\d{4,14}$/.test(o.code) ? o.code : ''
  const gramos = gramosRacionDe(o, nombre)
  const kj = valor100(nu, ['energy-kj_100g', 'energy_100g'], ['energy-kj_serving', 'energy_serving'], gramos)
  let kcal = valor100(nu, ['energy-kcal_100g'], ['energy-kcal_serving'], gramos)
  if (kcal === null && kj !== null) kcal = kj / 4.184
  const por100 = cerrarNutrientes({
    energia_kcal: kcal,
    proteinas: valor100(nu, ['proteins_100g'], ['proteins_serving'], gramos),
    carbohidratos: valor100(nu, ['carbohydrates_100g'], ['carbohydrates_serving'], gramos),
    azucares: valor100(nu, ['sugars_100g'], ['sugars_serving'], gramos),
    grasas: valor100(nu, ['fat_100g'], ['fat_serving'], gramos),
    grasas_saturadas: valor100(nu, ['saturated-fat_100g'], ['saturated-fat_serving'], gramos),
    fibra: valor100(nu, ['fiber_100g', 'fibers_100g'], ['fiber_serving'], gramos),
    sal: null,
  })
  const salDirecta = valor100(nu, ['salt_100g'], ['salt_serving'], gramos)
  const sodio = valor100(nu, ['sodium_100g'], ['sodium_serving'], gramos)
  por100.sal = cerrarNutrientes({ ...por100, sal: salDirecta ?? (sodio === null ? null : sodio * 2.5) }).sal
  if (por100.energia_kcal === null) return null
  const cadenas = detectarCadenas(o)
  const marca = limpio(Array.isArray(o.brands) ? o.brands[0] : typeof o.brands === 'string' ? o.brands.split(',')[0] : '', 60) || null
  const unidad: 'g' | 'ml' = o.product_quantity_unit === 'ml' ? 'ml' : 'g'
  return {
    id: codigo ? `off:${codigo}` : `off:${sinAcentos(nombre).slice(0, 40)}`,
    codigo: codigo || null,
    nombre,
    marca,
    cadenas,
    cadena_prioritaria: cadenas[0] ?? null,
    unidad,
    por_100g: por100,
    gramos_porcion: gramos,
    por_porcion: gramos ? escalarNutrientes(por100, gramos) : null,
    fuente: 'off',
  }
}

export function alimentoDesdeBedca(ficha: { id: string; nombre: string; nutrientes: Nutrientes; gramosPorcion: number }): AlimentoCatalogo | null {
  const por100 = cerrarNutrientes(ficha.nutrientes)
  if (por100.energia_kcal === null) return null
  const gramos = ficha.gramosPorcion
  return {
    id: `bedca:${ficha.id}`,
    codigo: null,
    nombre: ficha.nombre.slice(0, 100),
    marca: null,
    cadenas: [],
    cadena_prioritaria: null,
    unidad: 'g',
    por_100g: por100,
    gramos_porcion: gramos,
    por_porcion: escalarNutrientes(por100, gramos),
    fuente: 'bedca',
  }
}

function tokens(q: string): string[] {
  return sinAcentos(q)
    .split(' ')
    .filter((w) => w.length >= 3)
}

/** A igualdad de palabras, primero Mercadona, luego Carrefour, Caprabo, Eroski, Dia y Lidl. */
export function ordenarCatalogo(lista: AlimentoCatalogo[], consulta: string): AlimentoCatalogo[] {
  const ps = tokens(consulta)
  const rango = (id: CadenaId | null) => (id ? CADENAS.findIndex((c) => c.id === id) : CADENAS.length)
  return lista
    .map((p, i) => {
      const n = sinAcentos(`${p.nombre} ${p.marca ?? ''}`)
      const s = ps.reduce((acc, w) => acc + (n.includes(w) ? 2 : 0), 0)
      return { p, i, s, r: rango(p.cadena_prioritaria) }
    })
    .sort((a, b) => b.s - a.s || a.r - b.r || a.i - b.i)
    .map((x) => x.p)
}

function deduplicar(lista: AlimentoCatalogo[], max: number): AlimentoCatalogo[] {
  const vistos = new Set<string>()
  const salida: AlimentoCatalogo[] = []
  for (const p of lista) {
    const clave = p.codigo || sinAcentos(p.nombre)
    if (!clave || vistos.has(clave)) continue
    vistos.add(clave)
    salida.push(p)
    if (salida.length >= max) break
  }
  return salida
}

function algunoCoincide(consulta: string, productos: unknown[]): boolean {
  const ps = tokens(consulta)
  if (!ps.length) return false
  return productos.some((p) => {
    const o = (p ?? {}) as Record<string, unknown>
    const n = sinAcentos(`${limpio(o.product_name_es, 120)} ${limpio(o.product_name, 120)} ${limpio(o.brands, 80)}`)
    return ps.some((w) => n.includes(w))
  })
}

// ------------------------------------------------------------------- caché D1
interface EntradaCache<T> {
  datos: T
  fresca: boolean
}

async function leerCache<T>(env: Env, clave: string): Promise<EntradaCache<T> | null> {
  try {
    const externa = await leerCheckpoint(env, 'catalogo_alimentos_cache', clave)
    const ahora = Math.floor(Date.now() / 1000)
    if (externa) return { datos: JSON.parse(externa.datos) as T, fresca: externa.expira_en > ahora }
    if (externa === null) return null
    const fila = await env.DB.prepare('SELECT datos, expira_en FROM catalogo_alimentos_cache WHERE clave = ?1').bind(clave).first<{ datos: string; expira_en: number }>()
    if (!fila) return null
    return { datos: JSON.parse(fila.datos) as T, fresca: fila.expira_en > ahora }
  } catch {
    return null
  }
}

function guardarCacheD1(ctx: Ctx, clave: string, tipo: 'barcode' | 'buscar', json: string, expiraEn: number, ahora: number) {
  return ctx.env.DB.batch([
    ctx.env.DB.prepare(
      `INSERT INTO catalogo_alimentos_cache (clave, tipo, datos, expira_en, actualizado)
       VALUES (?1, ?2, ?3, ?4, ?5)
       ON CONFLICT (clave) DO UPDATE SET datos = excluded.datos, tipo = excluded.tipo, expira_en = excluded.expira_en, actualizado = excluded.actualizado`,
    ).bind(clave, tipo, json, expiraEn, ahora),
    ctx.env.DB.prepare('DELETE FROM catalogo_alimentos_cache WHERE expira_en < ?1').bind(ahora),
  ]).then(() => undefined)
}

function guardarCache(ctx: Ctx, clave: string, tipo: 'barcode' | 'buscar', datos: unknown) {
  const ahora = Math.floor(Date.now() / 1000)
  const json = JSON.stringify(datos)
  if (json.length > 200_000) return
  const expiraEn = ahora + TTL_CATALOGO_S
  const fila = { clave, tipo, datos: json, expiraEn, actualizado: ahora }
  if (aplazarEnTurso(ctx, () => guardarCheckpoint(ctx.env, 'catalogo_alimentos_cache', fila), () => guardarCacheD1(ctx, clave, tipo, json, expiraEn, ahora))) return
  ctx.waitUntil(guardarCacheD1(ctx, clave, tipo, json, expiraEn, ahora).catch((e: unknown) => console.warn('[catalogo] caché no guardada:', e instanceof Error ? e.message : e)))
}

async function productosOffEspana(consulta: string): Promise<unknown[]> {
  const q = encodeURIComponent(consulta)
  const v2 = `${BASE}/api/v2/search?search_terms=${q}&countries_tags_en=spain&json=1&page_size=24&lc=es&fields=${CAMPOS}`
  try {
    const datos = (await pedirJson(v2, 1, 4000)) as { products?: unknown[] } | null
    const products = Array.isArray(datos?.products) ? datos.products : []
    // v2 no hace búsqueda de texto: si ignora search_terms, los productos no contienen la consulta.
    if (products.length && algunoCoincide(consulta, products)) return products
  } catch (e) {
    console.warn('[catalogo] búsqueda v2 no disponible:', e instanceof Error ? e.message : e)
  }
  const cgi = `${BASE}/cgi/search.pl?search_terms=${q}&search_simple=1&action=process&json=1&page_size=24&countries_tags_en=spain&lc=es&fields=${CAMPOS}`
  const datos = (await pedirJson(cgi, 1, 7000)) as { products?: unknown[] } | null
  return Array.isArray(datos?.products) ? datos.products : []
}

async function buscarEnOff(consulta: string): Promise<AlimentoCatalogo[]> {
  const crudos = await productosOffEspana(consulta)
  const normales = crudos.map((p) => normalizarProductoOff(p)).filter((p): p is AlimentoCatalogo => !!p)
  return deduplicar(ordenarCatalogo(normales, consulta), 12)
}

export async function productoCatalogoPorCodigo(codigo: string, ctx: Ctx): Promise<{ producto: AlimentoCatalogo | null; cache: boolean }> {
  const clave = `b:${codigo}`
  const cache = await leerCache<AlimentoCatalogo>(ctx.env, clave)
  if (cache?.fresca && cache.datos && typeof cache.datos === 'object' && 'por_100g' in cache.datos) {
    return { producto: cache.datos, cache: true }
  }
  if (!(await hayCupoOff(ctx.env, 'producto'))) {
    if (cache?.datos && 'por_100g' in cache.datos) return { producto: cache.datos, cache: true }
    throw new HttpError(429, 'Hay muchas consultas a Open Food Facts ahora mismo. Inténtalo en un minuto.')
  }
  try {
    const datos = (await pedirJson(`${BASE}/api/v2/product/${codigo}.json?fields=${CAMPOS}&lc=es`, 2, 6000)) as { product?: unknown; status?: number } | null
    const producto = datos?.product ? normalizarProductoOff({ code: codigo, ...(datos.product as object) }, codigo) : null
    if (producto) guardarCache(ctx, clave, 'barcode', producto)
    else if (cache?.datos && 'por_100g' in cache.datos) return { producto: cache.datos, cache: true }
    return { producto, cache: false }
  } catch (e) {
    if (cache?.datos && 'por_100g' in cache.datos) return { producto: cache.datos, cache: true }
    console.warn('[catalogo] código no disponible:', e instanceof Error ? e.message : e)
    throw new HttpError(503, 'Open Food Facts no responde ahora mismo. Prueba de nuevo en unos minutos.', { codigo: 'off_no_disponible' })
  }
}

function esListaCatalogo(v: unknown): v is AlimentoCatalogo[] {
  return Array.isArray(v) && v.every((p) => !!p && typeof p === 'object' && typeof (p as AlimentoCatalogo).nombre === 'string' && typeof (p as AlimentoCatalogo).por_100g === 'object')
}

export async function buscarCatalogo(consulta: string, ctx: Ctx): Promise<{ alimentos: AlimentoCatalogo[]; cache: boolean }> {
  const termino = terminoOFF(consulta)
  if (termino.length < 2) return { alimentos: [], cache: false }
  const food_query = foodQuery(termino, 'foodcat')
  if (food_query) {
    const enKv = await leerKv(ctx.env, food_query, esListaCatalogo)
    if (enKv) return { alimentos: enKv, cache: true }
  }
  const clave = `q:${termino}`.slice(0, 120)
  const cache = await leerCache<AlimentoCatalogo[]>(ctx.env, clave)
  if (cache?.fresca && Array.isArray(cache.datos)) {
    if (food_query) guardarKv(ctx, food_query, cache.datos)
    return { alimentos: cache.datos, cache: true }
  }

  const fresco = esConsultaFresco(consulta)
  let off: AlimentoCatalogo[] = []
  let offFallo = false
  if (await hayCupoOff(ctx.env, 'busqueda')) {
    try {
      off = await buscarEnOff(termino)
    } catch (e) {
      offFallo = true
      console.warn('[catalogo] búsqueda no disponible:', e instanceof Error ? e.message : e)
    }
  } else if (!cache) {
    offFallo = true
  }

  let bedca: AlimentoCatalogo[] = []
  if (fresco) {
    const ficha = await buscarFrescoBedca(consulta).catch((e: unknown) => {
      console.warn('[bedca] fallo:', e instanceof Error ? e.message : e)
      return null
    })
    const alimento = ficha ? alimentoDesdeBedca(ficha) : null
    if (alimento) bedca = [alimento]
  }

  if (!off.length && !bedca.length) {
    if (cache && Array.isArray(cache.datos)) return { alimentos: cache.datos, cache: true }
    if (offFallo && !fresco) return { alimentos: [], cache: false }
    return { alimentos: [], cache: false }
  }

  const alimentos = deduplicar([...bedca, ...off], 12)
  if (food_query) guardarKv(ctx, food_query, alimentos)
  guardarCache(ctx, clave, 'buscar', alimentos)
  return { alimentos, cache: false }
}
