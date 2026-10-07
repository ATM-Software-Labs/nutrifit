/** Generación de los CSV de exportación (comidas, peso, agua) para un rango. */
import type { Env } from './env.ts'
import { generarCsv } from './csv.ts'
import { aComidaApi, type FilaComida } from './comidas.ts'
import { listarPesos } from './turso.ts'

const NOMBRE_TIPO: Record<string, string> = { desayuno: 'Desayuno', comida: 'Comida', cena: 'Cena', snack: 'Snack' }

export async function csvExportacion(env: Env, usuarioId: string, tipo: 'comidas' | 'peso' | 'agua', desde: string, hasta: string): Promise<string> {
  if (tipo === 'comidas') {
    const { results } = await env.DB.prepare('SELECT * FROM diario_comidas WHERE usuario_id = ?1 AND fecha BETWEEN ?2 AND ?3 ORDER BY fecha, creado_en')
      .bind(usuarioId, desde, hasta)
      .all<FilaComida>()
    return generarCsv(
      ['Fecha', 'Tipo', 'Descripción', 'Calorías (kcal)', 'Proteínas (g)', 'Carbohidratos (g)', 'Grasas (g)', 'Ingredientes'],
      results.map((f) => {
        const c = aComidaApi(f)
        const ingr = (c.ingredientes as { nombre?: string; gramos?: number }[])
          .map((i) => `${i.nombre ?? ''}${typeof i.gramos === 'number' ? ` (${i.gramos} g)` : ''}`)
          .join(' | ')
        return [c.fecha, NOMBRE_TIPO[c.tipo_comida] ?? c.tipo_comida, c.descripcion, c.calorias, c.proteinas, c.carbohidratos, c.grasas, ingr]
      }),
    )
  }
  if (tipo === 'peso') {
    const results = await listarPesos(env, usuarioId, desde, hasta)
    return generarCsv(['Fecha', 'Peso (kg)'], results.map((r) => [r.fecha, r.peso]))
  }
  const { results } = await env.DB.prepare('SELECT fecha, ml FROM registro_agua WHERE usuario_id = ?1 AND fecha BETWEEN ?2 AND ?3 ORDER BY fecha')
    .bind(usuarioId, desde, hasta)
    .all<{ fecha: string; ml: number }>()
  return generarCsv(['Fecha', 'Agua (ml)'], results.map((r) => [r.fecha, r.ml]))
}

