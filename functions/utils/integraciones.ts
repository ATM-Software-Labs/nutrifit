/**
 * Quita Strava de integraciones_apps sin tocar el resto de proveedores.
 * La tabla no está en las migraciones: se inspeccionan sus columnas y, si no
 * está o no se reconoce, no se hace nada y no se lanza. Así el arranque
 * (/api/auth/yo) no depende de que la tabla exista.
 */
import type { Env } from './env.ts'

const COLUMNA = /^[A-Za-z_][A-Za-z0-9_]{0,40}$/
const MARCA = ['proveedor', 'servicio', 'app', 'tipo', 'nombre']
const SECRETO = /token|secreto|secret|clave|refresh|oauth|access|auth/i

function columna(nombre: string): string | null {
  return COLUMNA.test(nombre) ? nombre : null
}

export async function desvincularStrava(env: Env): Promise<void> {
  try {
    const tabla = await env.DB.prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'integraciones_apps'").first<{ ok: number }>()
    if (!tabla) return
    const info = await env.DB.prepare('PRAGMA table_info(integraciones_apps)').all<{ name: string }>()
    const columnas = (info.results ?? []).map((c) => c.name)
    const marca = MARCA.map((n) => columnas.find((c) => c.toLowerCase() === n)).find((c): c is string => !!c && !!columna(c))
    if (!marca) return
    const segura = columna(marca)
    if (!segura) return
    await env.DB.prepare(`DELETE FROM integraciones_apps WHERE lower(${segura}) = 'strava'`).run()
  } catch {
    await anularTokensStrava(env)
  }
}

/** Si el DELETE no cuadra con la tabla, se vacían solo las columnas secretas de las filas Strava. */
async function anularTokensStrava(env: Env): Promise<void> {
  try {
    const info = await env.DB.prepare('PRAGMA table_info(integraciones_apps)').all<{ name: string }>()
    const columnas = (info.results ?? []).map((c) => c.name).filter((c) => columna(c))
    const marca = MARCA.map((n) => columnas.find((c) => c.toLowerCase() === n)).find((c): c is string => !!c)
    if (!marca) return
    const secretos = columnas.filter((c) => c !== marca && SECRETO.test(c))
    if (secretos.length === 0) return
    const set = secretos.map((c) => `${c} = NULL`).join(', ')
    await env.DB.prepare(`UPDATE integraciones_apps SET ${set} WHERE lower(${marca}) = 'strava'`).run()
  } catch {
    /* una tabla rara no puede tumbar la petición */
  }
}

export interface IntegracionPublica {
  proveedor: string
  estado: string | null
}

/** Lista del usuario, sin tokens. Si no se puede filtrar por usuario, no se devuelve nada. */
export async function listarIntegraciones(env: Env, usuarioId: string): Promise<IntegracionPublica[]> {
  await desvincularStrava(env)
  try {
    const info = await env.DB.prepare('PRAGMA table_info(integraciones_apps)').all<{ name: string }>()
    const columnas = (info.results ?? []).map((c) => c.name)
    if (!columnas.some((c) => c.toLowerCase() === 'usuario_id')) return []
    const marca = MARCA.map((n) => columnas.find((c) => c.toLowerCase() === n)).find((c): c is string => !!c && !!columna(c))
    if (!marca) return []
    const estado = columnas.find((c) => c.toLowerCase() === 'estado')
    const estadoSql = estado && columna(estado) ? estado : 'NULL'
    const { results } = await env.DB.prepare(
      `SELECT ${marca} AS proveedor, ${estadoSql} AS estado FROM integraciones_apps WHERE usuario_id = ?1`,
    )
      .bind(usuarioId)
      .all<{ proveedor: string | null; estado: string | null }>()
    return (results ?? [])
      .filter((f) => f.proveedor && f.proveedor.toLowerCase() !== 'strava')
      .map((f) => ({ proveedor: String(f.proveedor), estado: f.estado ?? null }))
  } catch {
    return []
  }
}
