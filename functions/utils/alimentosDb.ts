/**
 * Consultas a la BD nutrifit-alimentos (binding ALIMENTOS): FTS5 + ranking +
 * corrección de erratas con la tabla vocabulario. Si el binding no existe
 * (p. ej. en un entorno sin la BD) devuelve [] y la app sigue con la lista local.
 */
import type { Env } from './env.ts'
import { corregir, expresionFts, ordenar, terminos, type FilaAlimentoDB } from './buscador.ts'

export const CATEGORIAS_BD = ['Frutas', 'Verduras', 'Dulces y snacks', 'Legumbres', 'Cereales y pan', 'Lácteos', 'Aceites y grasas', 'Huevos', 'Carnes',
  'Embutidos', 'Pescados y mariscos', 'Frutos secos', 'Salsas y condimentos', 'Platos', 'Bebidas', 'Suplementos', 'Patatas y tubérculos', 'Especias y hierbas']

export interface AlimentoGenerico {
  id: string
  nombre: string
  nombreOriginal: string | null
  categoria: string
  fuente: 'usda' | 'ciqual'
  por100: { calorias: number; proteinas: number; carbohidratos: number; grasas: number }
  extra: { azucares: number | null; saturadas: number | null; fibra: number | null; sal: number | null }
  porciones: { nombre: string; gramos: number }[]
}

const COLUMNAS = 'a.id, a.fuente, a.fuente_id, a.nombre, a.nombre_orig, a.sinonimos, a.categoria, a.kcal, a.proteinas, a.carbohidratos, a.grasas, a.azucares, a.saturadas, a.fibra, a.sal, a.traducido, a.prioridad'

async function consultar(db: D1Database, match: string, limite: number): Promise<FilaAlimentoDB[]> {
  const { results } = await db
    .prepare(`SELECT ${COLUMNAS}, bm25(alimentos_fts, 10.0, 6.0, 1.0) AS rango FROM alimentos_fts JOIN alimentos a ON a.id = alimentos_fts.rowid WHERE alimentos_fts MATCH ?1 ORDER BY rango LIMIT ?2`)
    .bind(match, limite)
    .all<FilaAlimentoDB>()
  return results ?? []
}

async function corregirTerminos(db: D1Database, ts: string[]): Promise<string[] | null> {
  let cambiado = false
  const salida: string[] = []
  for (const t of ts) {
    if (t.length < 4) {
      salida.push(t)
      continue
    }
    const { results } = await db
      .prepare('SELECT termino, n FROM vocabulario WHERE termino >= ?1 AND termino < ?2 AND length(termino) BETWEEN ?3 AND ?4 LIMIT 4000')
      .bind(t[0], String.fromCharCode(t.charCodeAt(0) + 1), Math.max(3, t.length - 2), t.length + 6)
      .all<{ termino: string; n: number }>()
    // La primera letra casi nunca se escribe mal; si no hay suerte, se prueba con la segunda.
    let c = corregir(t, results ?? [])
    if (!c && t.length >= 5) {
      const r2 = await db
        .prepare('SELECT termino, n FROM vocabulario WHERE substr(termino, 2, 2) = ?1 AND length(termino) BETWEEN ?2 AND ?3 LIMIT 4000')
        .bind(t.slice(1, 3), t.length - 1, t.length + 1)
        .all<{ termino: string; n: number }>()
      c = corregir(t, r2.results ?? [])
    }
    if (c) {
      cambiado = true
      salida.push(c)
    } else salida.push(t)
  }
  return cambiado ? salida : null
}

function aAlimento(f: FilaAlimentoDB, porciones: { nombre: string; gramos: number }[]): AlimentoGenerico {
  return {
    id: `${f.fuente === 'ciqual' ? 'ciqual' : 'usda'}-${f.fuente_id}`,
    nombre: f.nombre,
    nombreOriginal: f.traducido === 1 ? f.nombre_orig : f.traducido === 0 ? null : f.nombre_orig,
    categoria: CATEGORIAS_BD[f.categoria] ?? '',
    fuente: f.fuente === 'ciqual' ? 'ciqual' : 'usda',
    por100: { calorias: f.kcal, proteinas: f.proteinas, carbohidratos: f.carbohidratos, grasas: f.grasas },
    extra: { azucares: f.azucares, saturadas: f.saturadas, fibra: f.fibra, sal: f.sal },
    porciones,
  }
}

export async function buscarGenericos(env: Env, consulta: string, limite = 20): Promise<{ resultados: AlimentoGenerico[]; corregido: string | null }> {
  const db = env.ALIMENTOS
  const ts = terminos(consulta)
  if (!db || !ts.length) return { resultados: [], corregido: null }

  const lote = async (t: string[]) => {
    const [exactos, prefijo] = await Promise.all([consultar(db, expresionFts(t, false), 60), consultar(db, expresionFts(t, true), 80)])
    return [...exactos, ...prefijo]
  }
  let filas = await lote(ts)
  let usados = ts
  let corregido: string | null = null
  if (filas.length < 3) {
    const c = await corregirTerminos(db, ts)
    if (c) {
      const otras = await lote(c)
      if (otras.length) {
        filas = [...filas, ...otras]
        usados = c
        corregido = c.join(' ')
      }
    }
  }
  if (!filas.length && ts.length > 1) filas = await consultar(db, expresionFts(ts, true, 'OR'), 60) // al menos algo
  const top = ordenar(filas, usados, corregido ?? consulta).slice(0, limite)
  if (!top.length) return { resultados: [], corregido }

  const ids = top.map((f) => f.id)
  const { results: por } = await db
    .prepare(`SELECT alimento_id, nombre, gramos FROM porciones WHERE alimento_id IN (${ids.map((_, i) => `?${i + 1}`).join(',')})`)
    .bind(...ids)
    .all<{ alimento_id: number; nombre: string; gramos: number }>()
  const porId = new Map<number, { nombre: string; gramos: number }[]>()
  for (const p of por ?? []) porId.set(p.alimento_id, [...(porId.get(p.alimento_id) ?? []), { nombre: p.nombre, gramos: p.gramos }])
  return { resultados: top.map((f) => aAlimento(f, porId.get(f.id) ?? [])), corregido }
}
