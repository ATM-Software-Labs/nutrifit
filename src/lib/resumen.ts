/** Recalcula totales/restante/% en cliente (actualizaciones optimistas). */
import { TIPOS_COMIDA, type Comida, type Resumen, type Totales } from './tipos.ts'

const r1 = (n: number) => Math.round(n * 10) / 10
const CLAVES: (keyof Totales)[] = ['calorias', 'proteinas', 'carbohidratos', 'grasas']

export function recalcular(r: Resumen): Resumen {
  const totales: Totales = { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 }
  let n = 0
  for (const t of TIPOS_COMIDA)
    for (const c of r.comidas[t]) {
      n++
      for (const k of CLAVES) totales[k] += c[k]
    }
  for (const k of CLAVES) totales[k] = r1(totales[k])
  const m = r.metas
  return {
    ...r,
    totales,
    num_comidas: n,
    restante: m && (Object.fromEntries(CLAVES.map((k) => [k, r1(m[k] - totales[k])])) as unknown as Totales),
    porcentaje: m && (Object.fromEntries(CLAVES.map((k) => [k, m[k] > 0 ? Math.round((totales[k] / m[k]) * 100) : 0])) as unknown as Totales),
  }
}

export function conComida(r: Resumen, c: Comida): Resumen {
  return recalcular({ ...r, comidas: { ...r.comidas, [c.tipo_comida]: [...r.comidas[c.tipo_comida], c] } })
}

export function sinComida(r: Resumen, id: string): Resumen {
  const comidas = Object.fromEntries(TIPOS_COMIDA.map((t) => [t, r.comidas[t].filter((c) => c.id !== id)])) as Resumen['comidas']
  return recalcular({ ...r, comidas })
}

export function reemplazarComida(r: Resumen, idTemporal: string, c: Comida): Resumen {
  const comidas = Object.fromEntries(TIPOS_COMIDA.map((t) => [t, r.comidas[t].map((x) => (x.id === idTemporal ? c : x))])) as Resumen['comidas']
  return recalcular({ ...r, comidas })
}
