/** Productos propios del usuario (tabla productos_usuario, valores por 100 g/ml). */
import type { Env } from './env.ts'
import type { ProductoOFF } from './off.ts'
import type { ProductoEntrada } from './schemas.ts'

export interface FilaProducto {
  id: string
  codigo: string | null
  nombre: string
  marca: string | null
  calorias: number
  proteinas: number
  carbohidratos: number
  grasas: number
  azucares: number | null
  saturadas: number | null
  fibra: number | null
  sal: number | null
  racion_g: number | null
  envase_g: number | null
  unidad: 'g' | 'ml'
}

export interface ProductoPropio extends ProductoOFF {
  id: string
  fuente: 'propio'
}

const COLUMNAS = 'id, codigo, nombre, marca, calorias, proteinas, carbohidratos, grasas, azucares, saturadas, fibra, sal, racion_g, envase_g, unidad'

export const aProducto = (f: FilaProducto): ProductoPropio => ({
  id: f.id,
  codigo: f.codigo ?? '',
  nombre: f.nombre,
  marca: f.marca,
  por100: { calorias: f.calorias, proteinas: f.proteinas, carbohidratos: f.carbohidratos, grasas: f.grasas },
  extra: { azucares: f.azucares, saturadas: f.saturadas, fibra: f.fibra, sal: f.sal },
  racion: f.racion_g,
  envase: f.envase_g,
  unidad: f.unidad,
  fuente: 'propio',
})

/** null también si la tabla aún no existe (migración pendiente): se sigue con OFF. */
export async function productoPropioPorCodigo(env: Env, usuarioId: string, codigo: string): Promise<ProductoPropio | null> {
  try {
    const f = await env.DB.prepare(`SELECT ${COLUMNAS} FROM productos_usuario WHERE usuario_id = ?1 AND codigo = ?2`).bind(usuarioId, codigo).first<FilaProducto>()
    return f ? aProducto(f) : null
  } catch {
    return null
  }
}


export async function buscarPropios(env: Env, usuarioId: string, q: string, max = 8): Promise<ProductoPropio[]> {
  const palabras = q.trim().split(/\s+/).filter((w) => w.length >= 2).slice(0, 4)
  if (!palabras.length) return []
  // SQLite LIKE no ignora acentos: se compara también sin ellos con una versión normalizada en JS.
  try {
    const { results } = await env.DB.prepare(`SELECT ${COLUMNAS} FROM productos_usuario WHERE usuario_id = ?1 ORDER BY actualizado_en DESC LIMIT 500`)
      .bind(usuarioId)
      .all<FilaProducto>()
    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const ps = palabras.map(norm)
    return (results ?? [])
      .filter((f) => {
        const t = norm(`${f.nombre} ${f.marca ?? ''} ${f.codigo ?? ''}`)
        return ps.every((p) => t.includes(p))
      })
      .slice(0, max)
      .map(aProducto)
  } catch {
    return []
  }
}

export async function listarPropios(env: Env, usuarioId: string): Promise<ProductoPropio[]> {
  const { results } = await env.DB.prepare(`SELECT ${COLUMNAS} FROM productos_usuario WHERE usuario_id = ?1 ORDER BY actualizado_en DESC LIMIT 500`)
    .bind(usuarioId)
    .all<FilaProducto>()
  return (results ?? []).map(aProducto)
}

const valores = (p: ProductoEntrada) =>
  [p.codigo, p.nombre, p.marca, p.calorias, p.proteinas, p.carbohidratos, p.grasas, p.azucares, p.saturadas, p.fibra, p.sal, p.racion, p.envase, p.unidad] as const

/** Crea o, si ya hay uno con el mismo código de barras, lo actualiza. */
export async function guardarPropio(env: Env, usuarioId: string, p: ProductoEntrada): Promise<ProductoPropio> {
  const ahora = Math.floor(Date.now() / 1000)
  if (p.codigo) {
    const existente = await env.DB.prepare('SELECT id FROM productos_usuario WHERE usuario_id = ?1 AND codigo = ?2').bind(usuarioId, p.codigo).first<{ id: string }>()
    if (existente) return (await actualizarPropio(env, usuarioId, existente.id, p))!
  }
  const id = crypto.randomUUID()
  const f = await env.DB.prepare(
    `INSERT INTO productos_usuario (id, usuario_id, codigo, nombre, marca, calorias, proteinas, carbohidratos, grasas, azucares, saturadas, fibra, sal, racion_g, envase_g, unidad, creado_en, actualizado_en)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?17) RETURNING ${COLUMNAS}`,
  )
    .bind(id, usuarioId, ...valores(p), ahora)
    .first<FilaProducto>()
  return aProducto(f!)
}

export async function actualizarPropio(env: Env, usuarioId: string, id: string, p: ProductoEntrada): Promise<ProductoPropio | null> {
  const f = await env.DB.prepare(
    `UPDATE productos_usuario SET codigo = ?3, nombre = ?4, marca = ?5, calorias = ?6, proteinas = ?7, carbohidratos = ?8, grasas = ?9, azucares = ?10,
       saturadas = ?11, fibra = ?12, sal = ?13, racion_g = ?14, envase_g = ?15, unidad = ?16, actualizado_en = ?17
     WHERE id = ?1 AND usuario_id = ?2 RETURNING ${COLUMNAS}`,
  )
    .bind(id, usuarioId, ...valores(p), Math.floor(Date.now() / 1000))
    .first<FilaProducto>()
  return f ? aProducto(f) : null
}
