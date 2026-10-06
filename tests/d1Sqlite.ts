/**
 * D1 de pruebas sobre node:sqlite (SQLite real, en memoria) con las migraciones
 * de /migrations aplicadas: los tests ejercitan el SQL de verdad.
 */
import { DatabaseSync } from 'node:sqlite'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const DIR = join(import.meta.dirname, '..', 'migrations')

type Valor = string | number | bigint | null | Uint8Array
const norm = (a: unknown[]): Valor[] => a.map((v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : (v as Valor)))

export function d1Sqlite() {
  const db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = ON')
  for (const f of readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort()) db.exec(readFileSync(join(DIR, f), 'utf8'))

  const sentencia = (sql: string, args: unknown[] = []) => {
    const st = {
      sql,
      args,
      bind: (...a: unknown[]) => sentencia(sql, a),
      async first<T>(col?: string): Promise<T | null> {
        const fila = db.prepare(sql).get(...norm(args)) as Record<string, unknown> | undefined
        if (!fila) return null
        return (col ? fila[col] : { ...fila }) as T
      },
      async all<T>() {
        return { success: true, results: db.prepare(sql).all(...norm(args)).map((r) => ({ ...r })) as T[] }
      },
      async run() {
        const r = db.prepare(sql).run(...norm(args))
        return { success: true, meta: { changes: Number(r.changes) } }
      },
    }
    return st
  }
  return {
    sqlite: db,
    prepare: (sql: string) => sentencia(sql),
    async batch(sts: ReturnType<typeof sentencia>[]) {
      db.exec('BEGIN')
      try {
        const out = []
        for (const s of sts) out.push({ success: true, results: db.prepare(s.sql).all(...norm(s.args)).map((r) => ({ ...r })) })
        db.exec('COMMIT')
        return out
      } catch (e) {
        db.exec('ROLLBACK')
        throw e
      }
    },
  }
}

export const SECRETO_TEST = 't'.repeat(48)
export const entornoTest = () =>
  ({ DB: d1Sqlite(), AUTH_SECRET: SECRETO_TEST, ENVIRONMENT: 'development', APP_URL: 'https://nutri.trujillomingorance.com' }) as any

/** Contexto mínimo de Pages Function para llamar a un handler directamente. */
export function ctx(env: any, request: Request, sesion: { usuarioId: string; email: string } | null = null) {
  return {
    request,
    env,
    data: { ip: '203.0.113.7', sesion: sesion ? { ...sesion, exp: Math.floor(Date.now() / 1000) + 3600, via: 'cookie' } : null },
    waitUntil: () => {},
    next: async () => new Response(null),
    params: {},
  } as any
}

export const postJson = (ruta: string, body: unknown) =>
  new Request(`https://nutri.trujillomingorance.com${ruta}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

/** Errores lanzados por un handler (HttpError) como valor, para comprobar su status. */
export const capturar = (p: unknown): Promise<any> => Promise.resolve(p).catch((e: unknown) => e)
