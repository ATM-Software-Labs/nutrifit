/**
 * Motor de la cadena de proveedores de IA («IA blindada»).
 *
 *   petición ─► [proveedor 1: modelo a → modelo b] ─► [proveedor 2 …] ─► … ─► ErrorIA
 *
 * - Orden configurable con IA_PROVEEDORES (p. ej. "gemini,groq,trujillo,workersai").
 * - Timeout por llamada (IA_TIMEOUT_MS, 13 s) y presupuesto total (IA_PRESUPUESTO_MS, 45 s).
 * - Un reintento con jitter ante 429 / 5xx / error de red (si el Retry-After es corto).
 * - Circuit breaker: tras IA_CIRCUITO_FALLOS fallos de infraestructura seguidos
 *   (timeout, 429, 5xx, 401/403, licencia…) el proveedor se salta IA_CIRCUITO_MIN
 *   minutos. Estado en memoria del isolate + Cache API (por colo, sin escrituras en D1).
 *   Si TODOS los proveedores están «abiertos», se prueban igualmente (mejor eso que fallar).
 * - Cada respuesta pasa por `parsear` (Zod + coherencia): si no valida se prueba el
 *   siguiente modelo/proveedor; si el error es `definitivo` (p. ej. «no es una tabla
 *   nutricional») se corta la cadena.
 * - Logs: una línea JSON por petición con proveedor/modelo/latencias y motivo de cada
 *   fallo. NUNCA se registra la imagen, el texto del usuario ni la respuesta.
 */
import type { Env } from './env.ts'

export type IdProveedor = 'gemini' | 'groq' | 'trujillo' | 'workers-ai'
export const ORDEN_POR_DEFECTO: readonly IdProveedor[] = ['gemini', 'groq', 'trujillo', 'workers-ai']

export interface Imagen {
  bytes: Uint8Array
  mime: 'image/jpeg' | 'image/png' | 'image/webp'
}

export interface PeticionIA {
  /** Solo para los logs. */
  tarea: 'plato' | 'etiqueta' | 'texto' | 'diagnostico'
  sistema: string
  usuario: string
  imagen?: Imagen
  /** responseSchema (subconjunto OpenAPI) para Gemini; el resto usa modo JSON. */
  esquemaGemini?: unknown
  maxTokens?: number
  temperatura?: number
}

/** Adaptador de un proveedor. `llamar` devuelve el contenido crudo (texto u objeto). */
export interface ProveedorIA {
  id: IdProveedor
  /** null si se puede usar; si no, el motivo (sin clave, flag apagado…). */
  noDisponible(env: Env): string | null
  modelos(env: Env, conImagen: boolean): string[]
  /** ¿Acepta este modelo imágenes con ese mime? (por defecto jpeg/png/webp). */
  aceptaMime?(modelo: string, mime: Imagen['mime']): boolean
  llamar(env: Env, modelo: string, p: PeticionIA, signal: AbortSignal): Promise<unknown>
}

export type TipoFallo = 'http' | 'timeout' | 'red' | 'vacia' | 'licencia' | 'config' | 'formato'

/** Fallo de infraestructura de un proveedor (no de parseo). */
export class ErrorProveedor extends Error {
  tipo: TipoFallo
  estado: number | undefined
  reintentable: boolean
  reintentarEnMs: number | undefined
  constructor(tipo: TipoFallo, mensaje: string, opciones: { estado?: number; reintentable?: boolean; reintentarEnMs?: number } = {}) {
    super(mensaje)
    this.tipo = tipo
    this.estado = opciones.estado
    this.reintentable = opciones.reintentable ?? false
    this.reintentarEnMs = opciones.reintentarEnMs
  }
}

/** Error HTTP → ErrorProveedor (429 y 5xx reintentables; Retry-After en ms). */
export function errorHttp(proveedor: string, res: Response): ErrorProveedor {
  const ra = res.headers.get('retry-after')
  let ms: number | undefined
  if (ra) {
    const s = Number(ra)
    ms = Number.isFinite(s) ? s * 1000 : Math.max(0, Date.parse(ra) - Date.now()) || undefined
  }
  const reintentable = res.status === 429 || res.status >= 500
  return new ErrorProveedor('http', `${proveedor} HTTP ${res.status}`, { estado: res.status, reintentable, reintentarEnMs: ms })
}

/** Errores de fetch/abort → ErrorProveedor. */
export function errorRed(proveedor: string, e: unknown): ErrorProveedor {
  if (e instanceof ErrorProveedor) return e
  const nombre = (e as { name?: string })?.name
  if (nombre === 'TimeoutError' || nombre === 'AbortError') return new ErrorProveedor('timeout', `${proveedor} timeout`)
  return new ErrorProveedor('red', `${proveedor} red: ${e instanceof Error ? e.message.slice(0, 120) : String(e).slice(0, 120)}`, { reintentable: true })
}

export interface Intento {
  proveedor: IdProveedor
  modelo?: string
  ms?: number
  /** 'ok' o motivo del fallo (sin datos del usuario). */
  resultado: string
}

export class ErrorIA extends Error {
  /** El modelo respondió bien pero la entrada no sirve (p. ej. no es una tabla): no se prueba otro. */
  definitivo = false
  intentos: Intento[] = []
}

export interface ResultadoCadena<T> {
  proveedor: IdProveedor
  modelo: string
  resultado: T
  ms: number
  intentos: Intento[]
}

// ---------------------------------------------------------------- configuración
const ALIAS: Record<string, IdProveedor> = {
  gemini: 'gemini',
  google: 'gemini',
  groq: 'groq',
  trujillo: 'trujillo',
  'trujillo-ai': 'trujillo',
  workersai: 'workers-ai',
  'workers-ai': 'workers-ai',
  cloudflare: 'workers-ai',
  cf: 'workers-ai',
}

/** "gemini, groq,workersai" → ['gemini','groq','workers-ai'] (ignora desconocidos y duplicados). */
export function ordenProveedores(valor: string | undefined): IdProveedor[] {
  if (!valor?.trim()) return [...ORDEN_POR_DEFECTO]
  const out: IdProveedor[] = []
  for (const t of valor.split(',')) {
    const id = ALIAS[t.trim().toLowerCase()]
    if (id && !out.includes(id)) out.push(id)
  }
  return out.length ? out : [...ORDEN_POR_DEFECTO]
}

const entero = (v: string | undefined, def: number, min: number, max: number) => {
  const n = Number(v)
  return Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : def
}

export interface ConfigCadena {
  orden: IdProveedor[]
  timeoutMs: number
  presupuestoMs: number
  circuitoFallos: number
  circuitoMs: number
}

export function leerConfig(env: Env): ConfigCadena {
  return {
    orden: ordenProveedores(env.IA_PROVEEDORES),
    timeoutMs: entero(env.IA_TIMEOUT_MS, 13_000, 2_000, 60_000),
    presupuestoMs: entero(env.IA_PRESUPUESTO_MS, 45_000, 5_000, 120_000),
    circuitoFallos: entero(env.IA_CIRCUITO_FALLOS, 3, 1, 50),
    circuitoMs: entero(env.IA_CIRCUITO_MIN, 5, 1, 120) * 60_000,
  }
}

// ---------------------------------------------------------------- circuit breaker
export interface EstadoCircuito {
  fallos: number
  abiertoHasta: number
}
export interface AlmacenCircuito {
  leer(id: IdProveedor): Promise<EstadoCircuito | null>
  escribir(id: IdProveedor, e: EstadoCircuito | null): Promise<void>
}

const memoria = new Map<IdProveedor, EstadoCircuito>()
const URL_CIRCUITO = 'https://ia-circuito.nutrifit.internal/v1/'
const TTL_CIRCUITO_S = 30 * 60

function cacheApi(): Cache | null {
  const c = (globalThis as { caches?: { default?: Cache } }).caches
  return c?.default ?? null
}

/** Memoria del isolate + Cache API (si existe). Nunca lanza: sin estado = circuito cerrado. */
export const almacenPorDefecto: AlmacenCircuito = {
  async leer(id) {
    const m = memoria.get(id)
    if (m) return m
    try {
      const r = await cacheApi()?.match(URL_CIRCUITO + id)
      if (!r) return null
      const e = (await r.json()) as EstadoCircuito
      if (typeof e?.fallos === 'number' && typeof e?.abiertoHasta === 'number') {
        memoria.set(id, e)
        return e
      }
    } catch {
      /* sin caché: circuito cerrado */
    }
    return null
  },
  async escribir(id, e) {
    if (e) memoria.set(id, e)
    else memoria.delete(id)
    try {
      const c = cacheApi()
      if (!c) return
      if (e) {
        await c.put(URL_CIRCUITO + id, new Response(JSON.stringify(e), { headers: { 'content-type': 'application/json', 'cache-control': `max-age=${TTL_CIRCUITO_S}` } }))
      } else await c.delete(URL_CIRCUITO + id)
    } catch {
      /* ignorar */
    }
  },
}

/** Solo para tests. */
export function reiniciarCircuitos() {
  memoria.clear()
}

// ---------------------------------------------------------------- utilidades
const dormirPorDefecto = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export function base64(bytes: Uint8Array): string {
  let bin = ''
  const CH = 0x8000
  for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode(...bytes.subarray(i, i + CH))
  return btoa(bin)
}

export const dataUrl = (img: Imagen) => `data:${img.mime};base64,${base64(img.bytes)}`

/** Promesa con timeout (para env.AI.run, que no acepta AbortSignal). */
export function conTimeout<T>(p: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new ErrorProveedor('timeout', 'timeout'))
  return new Promise<T>((resolve, reject) => {
    const alAbortar = () => reject(new ErrorProveedor('timeout', 'timeout'))
    signal.addEventListener('abort', alAbortar, { once: true })
    p.then(
      (v) => {
        signal.removeEventListener('abort', alAbortar)
        resolve(v)
      },
      (e) => {
        signal.removeEventListener('abort', alAbortar)
        reject(e)
      },
    )
  })
}

const esDefinitivo = (e: unknown) => !!e && typeof e === 'object' && (e as { definitivo?: boolean }).definitivo === true

/** Motivo corto y sin datos del usuario para el log. */
function motivo(e: unknown): string {
  if (e instanceof ErrorProveedor) return e.estado ? `${e.tipo}_${e.estado}` : e.tipo
  const n = (e as { constructor?: { name?: string } })?.constructor?.name ?? 'Error'
  return n === 'ErrorParseo' ? 'parseo' : n === 'ZodError' ? 'esquema' : n.toLowerCase().slice(0, 30)
}
const esInfra = (e: unknown) => e instanceof ErrorProveedor && e.tipo !== 'vacia' && e.tipo !== 'formato'

export interface OpcionesCadena {
  /** Adaptadores (ia.ts pasa los reales de iaProveedores.ts; los tests, falsos). */
  proveedores?: Partial<Record<IdProveedor, ProveedorIA>>
  almacen?: AlmacenCircuito
  dormir?: (ms: number) => Promise<void>
  ahora?: () => number
  /** Diagnóstico: forzar proveedor y/o modelo e ignorar el circuito. */
  soloProveedor?: IdProveedor
  soloModelo?: string
  ignorarCircuito?: boolean
  config?: Partial<ConfigCadena>
}

/**
 * Ejecuta la cadena hasta que un proveedor devuelva algo que `parsear` acepte.
 * Lanza ErrorIA (con `intentos`) si todos fallan, o ErrorIA definitivo.
 */
export async function ejecutarCadena<T>(env: Env, p: PeticionIA, parsear: (crudo: unknown) => T, o: OpcionesCadena = {}): Promise<ResultadoCadena<T>> {
  const cfg = { ...leerConfig(env), ...o.config }
  const ahora = o.ahora ?? Date.now
  const dormir = o.dormir ?? dormirPorDefecto
  const almacen = o.almacen ?? almacenPorDefecto
  const registro = o.proveedores ?? {}
  const inicio = ahora()
  const limite = inicio + cfg.presupuestoMs
  const intentos: Intento[] = []
  const orden = o.soloProveedor ? [o.soloProveedor] : cfg.orden

  const probarProveedor = async (prov: ProveedorIA): Promise<ResultadoCadena<T> | null> => {
    let modelos = prov.modelos(env, !!p.imagen)
    if (o.soloModelo) modelos = [o.soloModelo]
    let falloInfra = false
    let algunExito = false
    for (const modelo of modelos) {
      if (p.imagen && prov.aceptaMime && !prov.aceptaMime(modelo, p.imagen.mime)) {
        intentos.push({ proveedor: prov.id, modelo, resultado: 'formato_no_soportado' })
        continue
      }
      for (let intento = 0; intento < 2; intento++) {
        const restante = limite - ahora()
        if (restante < 2_000) {
          intentos.push({ proveedor: prov.id, modelo, resultado: 'sin_presupuesto' })
          return null
        }
        const t0 = ahora()
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(new ErrorProveedor('timeout', 'timeout')), Math.min(cfg.timeoutMs, restante))
        try {
          const crudo = await prov.llamar(env, modelo, p, ctrl.signal).catch((e) => {
            throw ctrl.signal.aborted ? new ErrorProveedor('timeout', `${prov.id} timeout`) : e
          })
          const resultado = parsear(crudo)
          const ms = ahora() - t0
          intentos.push({ proveedor: prov.id, modelo, ms, resultado: 'ok' })
          if (!o.ignorarCircuito) await registrarExito(almacen, prov.id)
          return { proveedor: prov.id, modelo, resultado, ms: ahora() - inicio, intentos }
        } catch (e) {
          const ms = ahora() - t0
          intentos.push({ proveedor: prov.id, modelo, ms, resultado: motivo(e) })
          if (esDefinitivo(e)) {
            // El proveedor funciona; es la entrada la que no sirve.
            if (!o.ignorarCircuito) await registrarExito(almacen, prov.id)
            const err = new ErrorIA(e instanceof Error ? e.message : String(e))
            err.definitivo = true
            err.intentos = intentos
            throw err
          }
          if (esInfra(e)) falloInfra = true
          else algunExito = true // respondió (aunque no validase): el proveedor está vivo
          const pe = e instanceof ErrorProveedor ? e : null
          const espera = pe?.reintentarEnMs
          if (intento === 0 && pe?.reintentable && (espera === undefined || espera <= 3_000)) {
            await dormir(Math.max(espera ?? 0, 250 + Math.floor(Math.random() * 500)))
            continue
          }
          break
        } finally {
          clearTimeout(timer)
        }
      }
    }
    if (!o.ignorarCircuito) {
      if (algunExito) await registrarExito(almacen, prov.id)
      else if (falloInfra) await registrarFallo(almacen, prov.id, cfg, ahora())
    }
    return null
  }

  const abiertos: ProveedorIA[] = []
  try {
    for (const id of orden) {
      const prov = registro[id]
      if (!prov) continue
      const nd = prov.noDisponible(env)
      if (nd) {
        intentos.push({ proveedor: id, resultado: nd })
        continue
      }
      if (!o.ignorarCircuito) {
        const est = await almacen.leer(id)
        if (est && est.abiertoHasta > ahora()) {
          intentos.push({ proveedor: id, resultado: 'circuito_abierto' })
          abiertos.push(prov)
          continue
        }
      }
      const r = await probarProveedor(prov)
      if (r) return registrar(p, r)
    }
    // Todos los disponibles fallaron o estaban abiertos: se prueban los abiertos (half-open).
    for (const prov of abiertos) {
      const r = await probarProveedor(prov)
      if (r) return registrar(p, r)
    }
  } catch (e) {
    if (e instanceof ErrorIA) {
      console.warn(JSON.stringify({ ia: 'definitivo', tarea: p.tarea, ms: ahora() - inicio, intentos }))
    }
    throw e
  }
  console.error(JSON.stringify({ ia: 'fallo_total', tarea: p.tarea, ms: ahora() - inicio, intentos }))
  const err = new ErrorIA('No se pudo completar con ningún proveedor de IA')
  err.intentos = intentos
  throw err
}

function registrar<T>(p: PeticionIA, r: ResultadoCadena<T>): ResultadoCadena<T> {
  console.log(JSON.stringify({ ia: 'ok', tarea: p.tarea, proveedor: r.proveedor, modelo: r.modelo, ms: r.ms, intentos: r.intentos }))
  return r
}

async function registrarFallo(almacen: AlmacenCircuito, id: IdProveedor, cfg: ConfigCadena, ahora: number) {
  const e = (await almacen.leer(id)) ?? { fallos: 0, abiertoHasta: 0 }
  const fallos = e.fallos + 1
  if (fallos >= cfg.circuitoFallos) {
    console.warn(JSON.stringify({ ia: 'circuito_abierto', proveedor: id, minutos: cfg.circuitoMs / 60_000 }))
    await almacen.escribir(id, { fallos: 0, abiertoHasta: ahora + cfg.circuitoMs })
  } else await almacen.escribir(id, { fallos, abiertoHasta: e.abiertoHasta })
}

async function registrarExito(almacen: AlmacenCircuito, id: IdProveedor) {
  const e = await almacen.leer(id)
  if (e && (e.fallos > 0 || e.abiertoHasta > 0)) await almacen.escribir(id, null)
}
