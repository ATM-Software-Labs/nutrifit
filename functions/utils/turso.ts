/**
 * Escrituras que no son el estado actual del usuario.
 *
 * Se quedan en D1 (respuesta síncrona): usuarios, diario_comidas, registro_agua,
 * productos_usuario, sesiones, tokens, códigos, emparejamientos y rate_limits.
 *
 * Se desvían aquí cuando TURSO_DATABASE_URL y TURSO_AUTH_TOKEN están definidos:
 *   · historico_peso (el peso vigente sigue en usuarios.peso_kg)
 *   · eventos de seguridad (auth, cuota, error SQL)
 *   · cachés de Open Food Facts y del catálogo (checkpoints regenerables)
 *
 * El cliente es @libsql/client/web: habla HTTP y no carga el binario nativo.
 * Las escrituras se programan con waitUntil. Si Turso falla, el historial y las
 * cachés caen otra vez a D1 para no perder el dato.
 */
import { createClient, type Client } from '@libsql/client/web'
import type { Env } from './env.ts'
import type { EventoLog } from './log.ts'

export const ESQUEMA_TURSO = `
CREATE TABLE IF NOT EXISTS historico_peso (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL,
  peso REAL NOT NULL,
  fecha TEXT NOT NULL,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (usuario_id, fecha)
);
CREATE TABLE IF NOT EXISTS eventos (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  client_ip TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  latencia_ms INTEGER NOT NULL,
  status_code INTEGER NOT NULL,
  event_type TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_eventos_timestamp ON eventos (timestamp);
CREATE TABLE IF NOT EXISTS cache_off (
  clave TEXT PRIMARY KEY,
  datos TEXT NOT NULL,
  expira_en INTEGER NOT NULL,
  actualizado INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS catalogo_alimentos_cache (
  clave TEXT PRIMARY KEY,
  tipo TEXT NOT NULL,
  datos TEXT NOT NULL,
  expira_en INTEGER NOT NULL,
  actualizado INTEGER NOT NULL
);
`

type Ctx = { env: Env; waitUntil(p: Promise<unknown>): void }
type FilaPeso = { fecha: string; peso: number }

let clienteActual: Client | null = null
let urlActual: string | null = null
let esquemaListo: Promise<void> | null = null

export function tursoConfigurado(env: Env): boolean {
  const url = env.TURSO_DATABASE_URL?.trim() ?? ''
  const token = env.TURSO_AUTH_TOKEN?.trim() ?? ''
  return (url.startsWith('libsql://') || url.startsWith('https://')) && token.length > 0
}

function cliente(env: Env): Client {
  const url = env.TURSO_DATABASE_URL!.trim()
  if (!clienteActual || urlActual !== url) {
    clienteActual = createClient({ url, authToken: env.TURSO_AUTH_TOKEN!.trim(), intMode: 'number' })
    urlActual = url
    esquemaListo = null
  }
  return clienteActual
}

function asegurar(env: Env): Promise<void> {
  if (!esquemaListo) {
    const c = cliente(env)
    esquemaListo = c.executeMultiple(ESQUEMA_TURSO).catch((e: unknown) => {
      esquemaListo = null
      throw e
    })
  }
  return esquemaListo
}

function aviso(e: unknown) {
  console.warn('[turso]', e instanceof Error ? e.message : e)
}

/** Programa `trabajo` fuera de la respuesta. Devuelve false si Turso no está configurado. */
export function aplazarEnTurso(ctx: Ctx, trabajo: () => Promise<void>, alFallar?: () => Promise<void>): boolean {
  if (!tursoConfigurado(ctx.env)) return false
  ctx.waitUntil(
    trabajo().catch(async (e) => {
      aviso(e)
      await alFallar?.().catch(() => undefined)
    }),
  )
  return true
}

export async function guardarEventos(env: Env, eventos: EventoLog[]): Promise<void> {
  if (!tursoConfigurado(env) || eventos.length === 0) return
  await asegurar(env)
  await cliente(env).batch(
    eventos.map((e) => ({
      sql: `INSERT INTO eventos (id, timestamp, client_ip, endpoint, method, latencia_ms, status_code, event_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [crypto.randomUUID(), e.timestamp, e.client_ip, e.endpoint, e.method, e.latencia_ms, e.status_code, e.event_type],
    })),
    'write',
  )
}

async function pesoTurso(env: Env, usuarioId: string, fecha: string): Promise<number | null> {
  await asegurar(env)
  const rs = await cliente(env).execute({
    sql: 'SELECT peso FROM historico_peso WHERE usuario_id = ? AND fecha = ?',
    args: [usuarioId, fecha],
  })
  const peso = rs.rows[0]?.peso
  return typeof peso === 'number' ? peso : null
}

async function pesoD1(env: Env, usuarioId: string, fecha: string): Promise<number | null> {
  const fila = await env.DB.prepare('SELECT peso FROM historico_peso WHERE usuario_id = ?1 AND fecha = ?2')
    .bind(usuarioId, fecha)
    .first<{ peso: number }>()
  return fila?.peso ?? null
}

export async function pesoDelDia(env: Env, usuarioId: string, fecha: string): Promise<number | null> {
  if (tursoConfigurado(env)) {
    try {
      const peso = await pesoTurso(env, usuarioId, fecha)
      if (peso != null) return peso
    } catch (e) {
      aviso(e)
    }
  }
  return pesoD1(env, usuarioId, fecha)
}

export async function hayPesoPosterior(env: Env, usuarioId: string, fecha: string): Promise<boolean> {
  const local = await env.DB.prepare('SELECT 1 AS ok FROM historico_peso WHERE usuario_id = ?1 AND fecha > ?2 LIMIT 1')
    .bind(usuarioId, fecha)
    .first<{ ok: number }>()
  if (local) return true
  if (!tursoConfigurado(env)) return false
  try {
    await asegurar(env)
    const rs = await cliente(env).execute({
      sql: 'SELECT 1 AS ok FROM historico_peso WHERE usuario_id = ? AND fecha > ? LIMIT 1',
      args: [usuarioId, fecha],
    })
    return rs.rows.length > 0
  } catch (e) {
    aviso(e)
    return false
  }
}

async function listarD1(env: Env, usuarioId: string, desde: string, hasta?: string): Promise<FilaPeso[]> {
  const consulta = hasta
    ? env.DB.prepare('SELECT fecha, peso FROM historico_peso WHERE usuario_id = ?1 AND fecha >= ?2 AND fecha <= ?3 ORDER BY fecha').bind(usuarioId, desde, hasta)
    : env.DB.prepare('SELECT fecha, peso FROM historico_peso WHERE usuario_id = ?1 AND fecha >= ?2 ORDER BY fecha').bind(usuarioId, desde)
  const { results } = await consulta.all<FilaPeso>()
  return results
}

async function listarTurso(env: Env, usuarioId: string, desde: string, hasta?: string): Promise<FilaPeso[]> {
  await asegurar(env)
  const rs = await cliente(env).execute({
    sql: hasta
      ? 'SELECT fecha, peso FROM historico_peso WHERE usuario_id = ? AND fecha >= ? AND fecha <= ? ORDER BY fecha'
      : 'SELECT fecha, peso FROM historico_peso WHERE usuario_id = ? AND fecha >= ? ORDER BY fecha',
    args: hasta ? [usuarioId, desde, hasta] : [usuarioId, desde],
  })
  const filas: FilaPeso[] = []
  for (const row of rs.rows) {
    if (typeof row.fecha === 'string' && typeof row.peso === 'number') filas.push({ fecha: row.fecha, peso: row.peso })
  }
  return filas
}

/** Une el historial que aún está en D1 con el que ya vive en Turso. Turso gana por fecha. */
export async function listarPesos(env: Env, usuarioId: string, desde: string, hasta?: string): Promise<FilaPeso[]> {
  const local = await listarD1(env, usuarioId, desde, hasta)
  if (!tursoConfigurado(env)) return local
  let remoto: FilaPeso[] = []
  try {
    remoto = await listarTurso(env, usuarioId, desde, hasta)
  } catch (e) {
    aviso(e)
    return local
  }
  const porFecha = new Map(local.map((r) => [r.fecha, r]))
  for (const fila of remoto) porFecha.set(fila.fecha, fila)
  return [...porFecha.values()].sort((a, b) => a.fecha.localeCompare(b.fecha))
}

export function aplazarHistoricoPeso(ctx: Ctx, fila: { id: string; usuarioId: string; peso: number; fecha: string }): boolean {
  return aplazarEnTurso(
    ctx,
    async () => {
      await asegurar(ctx.env)
      await cliente(ctx.env).execute({
        sql: `INSERT INTO historico_peso (id, usuario_id, peso, fecha) VALUES (?, ?, ?, ?)
              ON CONFLICT (usuario_id, fecha) DO UPDATE SET peso = excluded.peso
              WHERE historico_peso.peso IS NOT excluded.peso`,
        args: [fila.id, fila.usuarioId, fila.peso, fila.fecha],
      })
    },
    () =>
      ctx.env.DB.prepare(
        `INSERT INTO historico_peso (id, usuario_id, peso, fecha) VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT (usuario_id, fecha) DO UPDATE SET peso = excluded.peso
         WHERE historico_peso.peso IS NOT excluded.peso`,
      )
        .bind(fila.id, fila.usuarioId, fila.peso, fila.fecha)
        .run()
        .then(() => undefined),
  )
}

export type TablaCheckpoint = 'cache_off' | 'catalogo_alimentos_cache'

/** `undefined` = Turso no configurado o caído (hay que leer D1). `null` = no está. */
export async function leerCheckpoint(env: Env, tabla: TablaCheckpoint, clave: string): Promise<{ datos: string; expira_en: number } | null | undefined> {
  if (!tursoConfigurado(env)) return undefined
  try {
    await asegurar(env)
    const rs = await cliente(env).execute({
      sql: `SELECT datos, expira_en FROM ${tabla} WHERE clave = ?`,
      args: [clave],
    })
    const row = rs.rows[0]
    if (!row || typeof row.datos !== 'string' || typeof row.expira_en !== 'number') return null
    return { datos: row.datos, expira_en: row.expira_en }
  } catch (e) {
    aviso(e)
    return undefined
  }
}

/** Borra checkpoints caducados. La llama la limpieza que ya va en waitUntil. */
export async function purgarCheckpoints(env: Env, ahora: number): Promise<void> {
  if (!tursoConfigurado(env)) return
  await asegurar(env)
  await cliente(env).batch(
    [
      { sql: 'DELETE FROM cache_off WHERE expira_en < ?', args: [ahora - 7 * 86400] },
      { sql: 'DELETE FROM catalogo_alimentos_cache WHERE expira_en < ?', args: [ahora] },
    ],
    'write',
  )
}

export async function guardarCheckpoint(
  env: Env,
  tabla: TablaCheckpoint,
  fila: { clave: string; datos: string; expiraEn: number; actualizado: number; tipo?: 'barcode' | 'buscar' },
): Promise<void> {
  await asegurar(env)
  if (tabla === 'cache_off') {
    await cliente(env).batch(
      [
        {
          sql: `INSERT INTO cache_off (clave, datos, expira_en, actualizado) VALUES (?, ?, ?, ?)
                ON CONFLICT (clave) DO UPDATE SET datos = excluded.datos, expira_en = excluded.expira_en, actualizado = excluded.actualizado`,
          args: [fila.clave, fila.datos, fila.expiraEn, fila.actualizado],
        },
        { sql: 'DELETE FROM cache_off WHERE expira_en < ?', args: [fila.actualizado] },
      ],
      'write',
    )
    return
  }
  await cliente(env).batch(
    [
      {
        sql: `INSERT INTO catalogo_alimentos_cache (clave, tipo, datos, expira_en, actualizado) VALUES (?, ?, ?, ?, ?)
              ON CONFLICT (clave) DO UPDATE SET datos = excluded.datos, tipo = excluded.tipo, expira_en = excluded.expira_en, actualizado = excluded.actualizado`,
        args: [fila.clave, fila.tipo ?? 'buscar', fila.datos, fila.expiraEn, fila.actualizado],
      },
      { sql: 'DELETE FROM catalogo_alimentos_cache WHERE expira_en < ?', args: [fila.actualizado] },
    ],
    'write',
  )
}
