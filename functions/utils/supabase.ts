/**
 * Supabase (PostgREST) desde el servidor: catálogo compartido de alimentos y platos
 * y copia diaria de D1. Solo se usa la clave service_role como secreto de Pages
 * (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY); nunca llega al navegador.
 *
 * Todo es "best effort": sin configuración o si Supabase no responde, se devuelve
 * null/false y la app sigue igual (las escrituras van por waitUntil).
 * El catálogo no guarda datos personales: ni usuario, ni fecha, ni notas.
 */
import { emojiPorTexto } from '../../src/lib/miniaturaComida.ts'

export interface SupaEnv {
  SUPABASE_URL?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
}

export const supabaseConfigurado = (env: SupaEnv) => !!(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY && /^https:\/\//.test(env.SUPABASE_URL))

/** Petición a /rest/v1 con la clave de servicio. Lanza si la respuesta no es 2xx. */
export async function supaFetch(env: SupaEnv, ruta: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  if (!supabaseConfigurado(env)) throw new Error('Supabase sin configurar')
  const { timeoutMs = 3000, headers, ...resto } = init
  const h = new Headers(headers)
  h.set('apikey', env.SUPABASE_SERVICE_ROLE_KEY!)
  h.set('authorization', `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`)
  if (resto.body && !h.has('content-type')) h.set('content-type', 'application/json')
  const res = await fetch(`${env.SUPABASE_URL!.replace(/\/+$/, '')}/rest/v1/${ruta.replace(/^\/+/, '')}`, { ...resto, headers: h, signal: AbortSignal.timeout(timeoutMs) })
  if (!res.ok) {
    const txt = (await res.text().catch(() => '')).slice(0, 300)
    throw new Error(`Supabase ${res.status}: ${txt}`)
  }
  return res
}

const sinAcentos = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const limpio = (s: unknown, max: number) => (typeof s === 'string' ? s.replace(/[<>\u0000-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim().slice(0, max) : '')
const num = (v: unknown, min: number, max: number): number | null => {
  const x = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN
  return Number.isFinite(x) && x >= min && x <= max ? Math.round(x * 100) / 100 : null
}

// ------------------------------------------------------------------ catálogo de productos
export type FuenteCatalogo = 'openfoodfacts' | 'usda' | 'usuario' | 'etiqueta' | 'ia' | 'bedca'

export interface ProductoCatalogoEntrada {
  codigo?: string | null
  nombre: string
  marca?: string | null
  unidad?: 'g' | 'ml' | null
  calorias: number
  proteinas?: number | null
  carbohidratos?: number | null
  grasas?: number | null
  azucares?: number | null
  saturadas?: number | null
  fibra?: number | null
  sal?: number | null
  envase?: number | null
  porcion?: number | null
  emoji?: string | null
  fuente: FuenteCatalogo
}

export interface FilaCatalogoAlimento {
  clave: string
  codigo_barras: string | null
  nombre: string
  marca: string | null
  unidad: 'g' | 'ml'
  kcal_100: number
  proteinas_100: number
  carbohidratos_100: number
  grasas_100: number
  azucares_100: number | null
  saturadas_100: number | null
  fibra_100: number | null
  sal_100: number | null
  envase: number | null
  porcion: number | null
  emoji: string | null
  fuente: FuenteCatalogo
  actualizado_en?: string
}

/** Valida y normaliza (valores por 100 g/ml). null si no es un producto aprovechable. */
export function filaCatalogoAlimento(p: ProductoCatalogoEntrada, ahora = new Date()): FilaCatalogoAlimento | null {
  const nombre = limpio(p.nombre, 120)
  if (!nombre || /^producto sin nombre$/i.test(nombre)) return null
  const kcal = num(p.calorias, 0, 950)
  if (kcal === null) return null
  const codigo = typeof p.codigo === 'string' && /^\d{8,14}$/.test(p.codigo) ? p.codigo : null
  const marcaBruta = limpio(p.marca, 80)
  const marca = marcaBruta && !/^gen[eé]rico$/i.test(marcaBruta) ? marcaBruta : null
  const clave = codigo ? `ean:${codigo}` : `n:${sinAcentos(`${nombre}|${marca ?? ''}`).slice(0, 150)}`
  const g = (v: unknown) => num(v, 0, 100)
  return {
    clave,
    codigo_barras: codigo,
    nombre,
    marca,
    unidad: p.unidad === 'ml' ? 'ml' : 'g',
    kcal_100: kcal,
    proteinas_100: g(p.proteinas) ?? 0,
    carbohidratos_100: g(p.carbohidratos) ?? 0,
    grasas_100: g(p.grasas) ?? 0,
    azucares_100: g(p.azucares),
    saturadas_100: g(p.saturadas),
    fibra_100: g(p.fibra),
    sal_100: g(p.sal),
    envase: num(p.envase, 1, 10_000),
    porcion: num(p.porcion, 1, 2000),
    emoji: limpio(p.emoji, 16) || emojiPorTexto(nombre),
    fuente: p.fuente,
    actualizado_en: ahora.toISOString(),
  }
}

/**
 * Upsert en catalogo_alimentos. Lo de fuentes públicas (OFF, USDA, BEDCA) actualiza;
 * lo que crea un usuario solo se añade si el código aún no está (no pisa datos públicos).
 */
export async function guardarEnCatalogo(env: SupaEnv, productos: ProductoCatalogoEntrada[]): Promise<number> {
  if (!supabaseConfigurado(env)) return 0
  const porClave = new Map<string, FilaCatalogoAlimento>()
  for (const p of productos) {
    const f = filaCatalogoAlimento(p)
    if (f) porClave.set(f.clave, f)
  }
  const filas = [...porClave.values()]
  if (!filas.length) return 0
  const publicas = filas.filter((f) => f.fuente === 'openfoodfacts' || f.fuente === 'usda' || f.fuente === 'bedca')
  const propias = filas.filter((f) => !publicas.includes(f))
  const enviar = (lote: FilaCatalogoAlimento[], resolucion: 'merge-duplicates' | 'ignore-duplicates') =>
    lote.length
      ? supaFetch(env, 'catalogo_alimentos?on_conflict=clave', {
          method: 'POST',
          headers: { prefer: `resolution=${resolucion},return=minimal` },
          body: JSON.stringify(lote),
        })
      : Promise.resolve(null)
  await Promise.all([enviar(publicas, 'merge-duplicates'), enviar(propias, 'ignore-duplicates')])
  return filas.length
}

/** Lanza la escritura en segundo plano: nunca bloquea ni rompe la respuesta al usuario. */
export function catalogarEnSegundoPlano(ctx: { env: SupaEnv; waitUntil(p: Promise<unknown>): void }, productos: ProductoCatalogoEntrada[]) {
  if (!supabaseConfigurado(ctx.env) || !productos.length) return
  ctx.waitUntil(guardarEnCatalogo(ctx.env, productos).catch((e: unknown) => console.warn('[supabase] catálogo no guardado:', e instanceof Error ? e.message : e)))
}

/** Busca por cualquiera de las variantes del EAN (timeout corto: es un paso intermedio del escáner). */
export async function catalogoPorCodigo(env: SupaEnv, variantes: string[], timeoutMs = 1500): Promise<FilaCatalogoAlimento | null> {
  const codigos = variantes.filter((v) => /^\d{8,14}$/.test(v))
  if (!supabaseConfigurado(env) || !codigos.length) return null
  try {
    const res = await supaFetch(env, `catalogo_alimentos?select=*&codigo_barras=in.(${codigos.join(',')})&limit=1`, { timeoutMs })
    const filas = (await res.json()) as FilaCatalogoAlimento[]
    return Array.isArray(filas) && filas[0] ? filas[0] : null
  } catch (e) {
    console.warn('[supabase] catálogo no disponible:', e instanceof Error ? e.message : e)
    return null
  }
}

// ------------------------------------------------------------------ catálogo de platos
/**
 * Nombre de plato apto para un catálogo compartido. Descarta lo que pueda llevar
 * datos personales (emails, enlaces, teléfonos, nombres propios tras «con/de»…).
 */
export function nombrePlatoCatalogo(descripcion: string): { nombre: string; nombre_norm: string } | null {
  const nombre = limpio(descripcion, 80)
  if (nombre.length < 2) return null
  if (/@|https?:|www\.|\d{6,}|\+\d/.test(nombre)) return null
  // «cena con Marta», «la tarta de mi abuela»: puede identificar a alguien → fuera.
  if (/\bcon\s+[A-ZÁÉÍÓÚÑ]/.test(nombre)) return null
  if (/\b(mi|tu|su|mis|tus|sus)\s+(madre|padre|abuel[ao]s?|novi[ao]|amig[ao]s?|herman[ao]s?|mujer|marido|pareja|hij[ao]s?|tí[ao]|suegr[ao])\b/i.test(nombre)) return null
  const nombre_norm = sinAcentos(nombre).replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
  if (nombre_norm.length < 2) return null
  return { nombre, nombre_norm }
}

export interface PlatoCatalogoEntrada {
  descripcion: string
  emoji?: string | null
  calorias: number
  proteinas: number
  carbohidratos: number
  grasas: number
  cantidad?: number | null
  unidad?: string | null
}

export async function registrarPlato(env: SupaEnv, c: PlatoCatalogoEntrada): Promise<boolean> {
  if (!supabaseConfigurado(env)) return false
  const n = nombrePlatoCatalogo(c.descripcion)
  if (!n) return false
  const unidad = c.unidad && ['g', 'ml', 'unidad', 'racion'].includes(c.unidad) ? c.unidad : null
  await supaFetch(env, 'rpc/nf_registrar_comida', {
    method: 'POST',
    headers: { prefer: 'return=minimal' },
    body: JSON.stringify({
      p_nombre_norm: n.nombre_norm,
      p_nombre: n.nombre,
      p_emoji: limpio(c.emoji, 16) || null,
      p_kcal: num(c.calorias, 0, 10_000) ?? 0,
      p_proteinas: num(c.proteinas, 0, 1000) ?? 0,
      p_carbohidratos: num(c.carbohidratos, 0, 2000) ?? 0,
      p_grasas: num(c.grasas, 0, 1000) ?? 0,
      p_cantidad: num(c.cantidad, 0, 10_000),
      p_unidad: unidad,
    }),
  })
  return true
}

export function registrarPlatoEnSegundoPlano(ctx: { env: SupaEnv; waitUntil(p: Promise<unknown>): void }, c: PlatoCatalogoEntrada) {
  if (!supabaseConfigurado(ctx.env)) return
  ctx.waitUntil(registrarPlato(ctx.env, c).catch((e: unknown) => console.warn('[supabase] plato no catalogado:', e instanceof Error ? e.message : e)))
}
