/**
 * Búsqueda en la base de alimentos genéricos (módulo PURO: normalización,
 * consulta FTS5, corrección de erratas y ranking). Lo usa utils/alimentosDb.ts.
 */

const VACIAS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'con', 'y', 'en', 'a', 'al', 'un', 'una', 'para', 'sin'])

/** "Pechuga de Pollo" → ["pechuga", "pollo"] (sin acentos ni palabras vacías; ñ → n como FTS5). */
export function terminos(q: string): string[] {
  const n = q
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
  const t = n.split(' ').filter((w) => w.length >= 2 && !VACIAS.has(w))
  // «sin» sí importa en «sin sal», «sin piel»: se conserva si va seguido de algo
  return [...new Set(t)].slice(0, 6)
}

/** Expresión MATCH segura (solo [a-z0-9]): exacta ("pan") o por prefijo ("pan"*). */
export function expresionFts(ts: string[], prefijo: boolean, modo: 'AND' | 'OR' = 'AND'): string {
  return ts.map((t) => `"${t.replace(/[^a-z0-9]/g, '')}"${prefijo ? '*' : ''}`).join(modo === 'AND' ? ' ' : ' OR ')
}

/** Distancia de Damerau–Levenshtein (OSA) con corte: devuelve max+1 si la supera. */
export function distancia(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0]![j] = j
  for (let i = 1; i <= a.length; i++) {
    let minFila = Infinity
    for (let j = 1; j <= b.length; j++) {
      const coste = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + coste)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2]![j - 2]! + 1)
      d[i]![j] = v
      if (v < minFila) minFila = v
    }
    if (minFila > max) return max + 1
  }
  return d[a.length]![b.length]!
}

/** Corrige un término con el vocabulario (más cercano; a igualdad, el más frecuente). */
export function corregir(t: string, vocabulario: { termino: string; n: number }[]): string | null {
  if (t.length < 4) return null
  const max = t.length >= 7 ? 2 : 1
  let mejor: { termino: string; d: number; n: number } | null = null
  for (const v of vocabulario) {
    if (v.termino === t) return null
    // Si es prefijo de una palabra, ya lo encuentra la búsqueda por prefijo de FTS5.
    if (v.termino.startsWith(t)) return null
    const completa = distancia(t, v.termino, max)
    const inicio = v.termino.length > t.length ? distancia(t, v.termino.slice(0, t.length), max) + 0.5 : max + 1 // palabra a medio escribir
    const d = Math.min(completa, inicio)
    if (d > max) continue
    if (!mejor || d < mejor.d || (d === mejor.d && v.n > mejor.n)) mejor = { termino: v.termino, d, n: v.n }
  }
  return mejor && mejor.d > 0 ? mejor.termino : null
}

export interface FilaAlimentoDB {
  id: number
  fuente: string
  fuente_id: string
  nombre: string
  nombre_orig: string
  sinonimos: string
  categoria: number
  kcal: number
  proteinas: number
  carbohidratos: number
  grasas: number
  azucares: number | null
  saturadas: number | null
  fibra: number | null
  sal: number | null
  traducido: number
  prioridad: number
  rango?: number
}

const sinAcentos = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const COCINADO = /\b(cocid|cocinad|asad|frit|hervid|plancha|horno|guisad|estofad|vapor|envasad|conserva|seco|seca|secas|secos|deshidratad|congelad|rebozad)\w*/

/**
 * Puntuación (más alta = mejor). Prima: nombres en español, coincidencia de
 * palabra completa, que empiece por la búsqueda, nombres cortos y alimentos
 * base (crudo/fresco) si el usuario no pidió una preparación.
 */
export function puntuar(f: FilaAlimentoDB, ts: string[], consulta: string): number {
  const nombre = sinAcentos(f.nombre)
  const palabras = nombre.split(' ')
  const sin = sinAcentos(f.sinonimos ?? '').split(' ')
  const orig = sinAcentos(f.nombre_orig ?? '').split(' ')
  let s = 0
  for (const t of ts) {
    if (palabras.includes(t) || palabras.includes(t + 's') || palabras.includes(t + 'es')) s += 3
    else if (palabras.some((w) => w.startsWith(t))) s += 1.5
    else if (sin.some((w) => w.startsWith(t))) s += 1
    else if (orig.some((w) => w.startsWith(t))) s += 0.3
  }
  const q = sinAcentos(consulta)
  if (q && nombre.startsWith(q)) s += 4
  else if (ts[0] && (palabras[0] === ts[0] || palabras[0]?.startsWith(ts[0]))) s += 2
  s += f.prioridad * 1.1
  if (!f.traducido) s -= 2.5
  s -= Math.min(f.nombre.length, 90) * 0.035
  if (!COCINADO.test(q) && COCINADO.test(nombre)) s -= 0.6
  if (/\b(crud|fresc)\w*/.test(nombre)) s += 0.3
  // bm25 de FTS5 (negativo; más negativo = mejor) como desempate
  if (typeof f.rango === 'number') s += Math.min(2, -f.rango / 10)
  return s
}

export function ordenar<T extends FilaAlimentoDB>(filas: T[], ts: string[], consulta: string): T[] {
  const vistos = new Set<number>()
  return filas
    .filter((f) => !vistos.has(f.id) && !!vistos.add(f.id))
    .map((f) => ({ f, p: puntuar(f, ts, consulta) }))
    .sort((a, b) => b.p - a.p)
    .map((x) => x.f)
}
