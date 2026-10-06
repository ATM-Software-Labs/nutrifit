/** Búsqueda local en la base de alimentos (sin acentos, por palabras). */
import { ALIMENTOS, CATEGORIAS, type FilaAlimento } from '../data/alimentos.ts'
import type { Totales } from './tipos.ts'

export interface Alimento {
  id: string
  nombre: string
  detalle: string
  por100: Totales
  racion: number | null
  fuente: 'local' | 'off'
}

export const normalizar = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .trim()

const aAlimento = (f: FilaAlimento): Alimento => ({
  id: `usda-${f[7]}-${f[0]}`,
  nombre: f[0],
  detalle: CATEGORIAS[f[1]] ?? '',
  por100: { calorias: f[2], proteinas: f[3], carbohidratos: f[4], grasas: f[5] },
  racion: f[6],
  fuente: 'local',
})

const INDICE = ALIMENTOS.map((f) => ({ f, n: normalizar(f[0]), palabras: normalizar(f[0]).split(' ') }))

export const categorias = CATEGORIAS

export function buscarLocal(consulta: string, categoria: number | null = null, max = 40): Alimento[] {
  const q = normalizar(consulta)
  const terminos = q.split(' ').filter(Boolean)
  const res: { a: FilaAlimento; p: number }[] = []
  for (const { f, n, palabras } of INDICE) {
    if (categoria !== null && f[1] !== categoria) continue
    if (!terminos.length) {
      res.push({ a: f, p: 0 })
      continue
    }
    // Todos los términos deben aparecer como inicio de alguna palabra (o dentro del nombre).
    let p = 0
    let ok = true
    for (const t of terminos) {
      if (palabras.some((w) => w.startsWith(t))) p += 0
      else if (n.includes(t)) p += 2
      else {
        ok = false
        break
      }
    }
    if (!ok) continue
    if (n.startsWith(q)) p -= 3
    p += n.length / 100 // a igualdad, los nombres cortos primero
    res.push({ a: f, p })
  }
  return res
    .sort((x, y) => x.p - y.p)
    .slice(0, max)
    .map((r) => aAlimento(r.a))
}

/** Macros para unos gramos (1 decimal; kcal enteras). */
export function escalar(por100: Totales, gramos: number): Totales {
  const k = gramos / 100
  const r = (v: number) => Math.round(v * k * 10) / 10
  return { calorias: Math.round(por100.calorias * k), proteinas: r(por100.proteinas), carbohidratos: r(por100.carbohidratos), grasas: r(por100.grasas) }
}
