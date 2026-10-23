/** Copia comidas de un día a otro del mismo usuario. Sin foto; macros, cantidades y notas igual. */
import type { Env } from './env.ts'
import type { FilaComida } from './comidas.ts'

export const MAX_COPIA = 60

const COLUMNAS = [
  'tipo_comida', 'descripcion', 'calorias', 'proteinas', 'carbohidratos', 'grasas', 'ingredientes_json',
  'emoji', 'fibra', 'azucares', 'sal', 'cantidad', 'unidad', 'envase', 'porcion', 'codigo_barras', 'hora', 'notas',
] as const

/** Filtra las filas del día origen: por id si se dan, si no por tipo, si no todas. */
export function elegirFilas(filas: FilaComida[], ids?: string[], tipos?: string[]): FilaComida[] {
  if (ids?.length) {
    const set = new Set(ids)
    return filas.filter((f) => set.has(f.id))
  }
  if (tipos?.length) return filas.filter((f) => tipos.includes(f.tipo_comida))
  return filas
}

export async function copiarComidas(env: Env, usuarioId: string, desde: string, hasta: string, ids?: string[], tipos?: string[]): Promise<FilaComida[]> {
  const res = await env.DB.prepare('SELECT * FROM diario_comidas WHERE usuario_id = ?1 AND fecha = ?2 ORDER BY creado_en LIMIT 200')
    .bind(usuarioId, desde)
    .all<FilaComida>()
  const elegidas = elegirFilas(res.results ?? [], ids, tipos).slice(0, MAX_COPIA)
  if (!elegidas.length) return []
  const cols = ['id', 'usuario_id', 'fecha', 'imagen_url', ...COLUMNAS]
  const sql = `INSERT INTO diario_comidas (${cols.join(', ')}) VALUES (${cols.map((_, i) => `?${i + 1}`).join(', ')}) RETURNING *`
  const stmts = elegidas.map((f) =>
    env.DB.prepare(sql).bind(crypto.randomUUID(), usuarioId, hasta, null, ...COLUMNAS.map((c) => (f as unknown as Record<string, unknown>)[c] ?? null)),
  )
  const out = await env.DB.batch(stmts)
  return out.flatMap((r) => (r.results ?? []) as FilaComida[])
}
