/**
 * Copia diaria de D1 (nutrifit-db) → Supabase (tabla bk_filas: tabla + pk + fila jsonb).
 * Copia completa en cada ejecución (los datos son pequeños): se suben todas las filas
 * con sincronizado_en = inicio y, si TODO ha ido bien, se borran las que no se han
 * visto (filas eliminadas en D1, p. ej. una cuenta dada de baja). Así la copia refleja
 * también los borrados y no conserva datos que el usuario ya pidió suprimir.
 *
 * No se copian tablas efímeras o de seguridad (sesiones, códigos de acceso, límites,
 * cachés públicas) ni los tokens OAuth de integraciones.
 */
import type { SupaEnv } from './supabase.ts'
import { supaFetch, supabaseConfigurado } from './supabase.ts'

export interface TablaCopia {
  tabla: string
  pk: string[]
  /** Columnas que no se copian (secretos). */
  excluir?: string[]
  /** Filtro SQL adicional (sin parámetros de usuario). */
  donde?: string
}

export const TABLAS_COPIA: TablaCopia[] = [
  { tabla: 'usuarios', pk: ['id'] },
  { tabla: 'diario_comidas', pk: ['id'] },
  { tabla: 'historico_peso', pk: ['id'] },
  { tabla: 'registro_agua', pk: ['usuario_id', 'fecha'] },
  { tabla: 'productos_usuario', pk: ['id'] },
  { tabla: 'entrenamientos', pk: ['id'] },
  { tabla: 'integraciones_apps', pk: ['id'], excluir: ['token_acceso', 'token_refresco'] },
  { tabla: 'amistades', pk: ['id'] },
  { tabla: 'comidas_frecuentes', pk: ['id'] },
  { tabla: 'archivos_usuario', pk: ['id'], donde: "clase IN ('avatar', 'banner')" },
  { tabla: 'usuario_logros', pk: ['usuario_id', 'logro_id'] },
  { tabla: 'push_suscripciones', pk: ['endpoint_hash'] },
  { tabla: 'recordatorios_pref', pk: ['usuario_id'] },
  { tabla: 'notificaciones_app', pk: ['id'] },
  { tabla: 'accesos_conocidos', pk: ['usuario_id', 'huella'] },
  { tabla: 'preferencias_cantidades', pk: ['usuario_id'] },
]

/** Tablas de D1 que se dejan fuera a propósito (para el test de cobertura). */
export const TABLAS_SIN_COPIA = [
  'magic_tokens', 'rate_limits', 'tokens_app', 'codigos_login', 'emparejamientos_qr', 'cache_off',
  'sesiones_web', 'catalogo_alimentos_cache', 'sesiones_dispositivos', 'recordatorios_envios',
]

export interface FilaCopia {
  tabla: string
  pk: string
  fila: Record<string, unknown>
  sincronizado_en: string
}

function aBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

/** Valor de D1 → JSON. Los BLOB (ArrayBuffer, Uint8Array o array de bytes) van en base64. */
function valorJson(v: unknown): unknown {
  if (v instanceof ArrayBuffer) return { base64: aBase64(new Uint8Array(v)) }
  if (ArrayBuffer.isView(v)) return { base64: aBase64(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)) }
  if (Array.isArray(v) && v.length > 64 && v.every((x) => Number.isInteger(x) && x >= 0 && x < 256)) return { base64: aBase64(Uint8Array.from(v as number[])) }
  if (typeof v === 'bigint') return Number(v)
  return v
}

export function filaParaCopia(t: TablaCopia, fila: Record<string, unknown>, sincronizadoEn: string): FilaCopia {
  const limpia: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(fila)) if (!t.excluir?.includes(k)) limpia[k] = valorJson(v)
  return { tabla: t.tabla, pk: t.pk.map((c) => String(fila[c] ?? '')).join('|'), fila: limpia, sincronizado_en: sincronizadoEn }
}

/** Agrupa en lotes de como mucho maxFilas y ~maxBytes de JSON. */
export function enLotes(filas: FilaCopia[], maxFilas = 500, maxBytes = 3_000_000): FilaCopia[][] {
  const lotes: FilaCopia[][] = []
  let actual: FilaCopia[] = []
  let bytes = 2
  for (const f of filas) {
    const b = JSON.stringify(f).length + 1
    if (actual.length && (actual.length >= maxFilas || bytes + b > maxBytes)) {
      lotes.push(actual)
      actual = []
      bytes = 2
    }
    actual.push(f)
    bytes += b
  }
  if (actual.length) lotes.push(actual)
  return lotes
}

export interface ResultadoCopia {
  ok: boolean
  inicio: string
  d1: Record<string, number>
  supabase: Record<string, number> | null
  subidas: number
  borradas: number
  error?: string
}

export async function copiarD1ASupabase(env: SupaEnv & { DB: D1Database }, ahora = new Date()): Promise<ResultadoCopia> {
  const inicio = ahora.toISOString()
  const d1: Record<string, number> = {}
  if (!supabaseConfigurado(env)) return { ok: false, inicio, d1, supabase: null, subidas: 0, borradas: 0, error: 'Supabase sin configurar' }

  // Una sola llamada a D1 para todas las tablas (lectura coherente y menos subpeticiones).
  // Algunas tablas existen solo en ciertos entornos: se copian las que haya.
  const existentes = new Set(((await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all<{ name: string }>()).results ?? []).map((r) => r.name))
  const tablas = TABLAS_COPIA.filter((t) => existentes.has(t.tabla))
  const sentencias = tablas.map((t) => env.DB.prepare(`SELECT * FROM ${t.tabla}${t.donde ? ` WHERE ${t.donde}` : ''}`))
  const resultados = sentencias.length ? await env.DB.batch<Record<string, unknown>>(sentencias) : []
  const filas: FilaCopia[] = []
  tablas.forEach((t, i) => {
    const rs = resultados[i]?.results ?? []
    d1[t.tabla] = rs.length
    for (const r of rs) filas.push(filaParaCopia(t, r, inicio))
  })

  let subidas = 0
  let borradas = 0
  let error: string | undefined
  try {
    for (const lote of enLotes(filas)) {
      await supaFetch(env, 'bk_filas?on_conflict=tabla,pk', {
        method: 'POST',
        headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(lote),
        timeoutMs: 20_000,
      })
      subidas += lote.length
    }
    // Solo si todo subió: fuera lo que ya no existe en D1.
    const res = await supaFetch(env, `bk_filas?sincronizado_en=lt.${encodeURIComponent(inicio)}`, {
      method: 'DELETE',
      headers: { prefer: 'return=minimal,count=exact' },
      timeoutMs: 20_000,
    })
    borradas = Number(res.headers.get('content-range')?.split('/')[1]) || 0
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
  }

  let supabase: Record<string, number> | null = null
  try {
    const res = await supaFetch(env, 'rpc/bk_resumen', { method: 'POST', body: '{}' })
    supabase = Object.fromEntries(((await res.json()) as { tabla: string; filas: number }[]).map((r) => [r.tabla, Number(r.filas)]))
  } catch (e) {
    error ??= e instanceof Error ? e.message : String(e)
  }

  const ok = !error
  try {
    await supaFetch(env, 'bk_ejecuciones', {
      method: 'POST',
      headers: { prefer: 'return=minimal' },
      body: JSON.stringify({ inicio, ok, filas: subidas, borradas, tablas: { d1, supabase }, error: error?.slice(0, 500) ?? null }),
    })
  } catch {
    /* el registro es informativo */
  }
  return { ok, inicio, d1, supabase, subidas, borradas, error }
}
