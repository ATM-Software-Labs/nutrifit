/**
 * Raciones coloquiales del texto libre. El modelo propone macros; aquí los
 * gramos salen de la tabla y las calorías se escalan con esa cantidad.
 * La leche se cuenta a 1 g/ml. El huevo y el aceite usan el punto medio del rango.
 */
import type { ResultadoAnalisis } from './iaParseo.ts'

const r1 = (n: number) => Math.round(n * 10) / 10

export function normalizarRacion(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .trim()
}

const NUMEROS: Record<string, number> = {
  un: 1,
  una: 1,
  uno: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
}

export interface RacionAplicada {
  gramos: number
  serving_description: string
}

interface Regla {
  id: string
  coincide: (t: string) => boolean
  /** Gramos de una unidad. */
  unidad: number
  /** No multiplica: la frase ya es la ración entera. */
  fija?: boolean
  describir: (n: number, gramos: number) => string
}

const entero = (n: number) => (Number.isInteger(n) ? String(n) : String(r1(n)))

export const REGLAS_RACION: Regla[] = [
  {
    id: 'media-barra',
    coincide: (t) => /\bmedia barra\b/.test(t) && /\bpan\b|\bbarra\b/.test(t),
    unidad: 125,
    fija: true,
    describir: (_n, g) => `media barra (~${entero(g)}g)`,
  },
  {
    id: 'plato-hondo',
    coincide: (t) => /\bplato hondo\b/.test(t),
    unidad: 350,
    describir: (n, g) => (n === 1 ? `1 plato hondo (~${entero(g)}g)` : `${entero(n)} platos hondos (~${entero(g)}g)`),
  },
  {
    id: 'punado',
    coincide: (t) => /\bpunados?\b|\bpunao\b|\bpunaos\b/.test(t),
    unidad: 30,
    describir: (n, g) => (n === 1 ? `1 puñado (~${entero(g)}g)` : `${entero(n)} puñados (~${entero(g)}g)`),
  },
  {
    id: 'cucharada-aceite',
    coincide: (t) => /\bcucharadas?\b/.test(t) && /\baceite\b/.test(t),
    unidad: 12,
    describir: (n, g) => (n === 1 ? `1 cucharada (~${entero(g)}g)` : `${entero(n)} cucharadas (~${entero(g)}g)`),
  },
  {
    id: 'vaso-leche',
    coincide: (t) => /\b(vaso|taza|vasos|tazas)\b/.test(t) && /\bleche\b/.test(t),
    unidad: 250,
    describir: (n, g) => (n === 1 ? `1 vaso (~${entero(g)} ml)` : `${entero(n)} vasos (~${entero(g)} ml)`),
  },
  {
    id: 'lata-atun',
    coincide: (t) => /\blatas?\b/.test(t) && /\batun\b/.test(t),
    unidad: 60,
    describir: (n, g) => (n === 1 ? `1 lata escurrida (~${entero(g)}g)` : `${entero(n)} latas escurridas (~${entero(g)}g)`),
  },
  {
    id: 'platano',
    coincide: (t) => /\bplatanos?\b/.test(t),
    unidad: 120,
    describir: (n, g) => (n === 1 ? '1 unidad mediana (~120g)' : `${entero(n)} unidades medianas (~${entero(g)}g)`),
  },
  {
    id: 'huevo',
    coincide: (t) => /\bhuevos?\b/.test(t) && !/\bclaras?\b/.test(t),
    unidad: 58,
    describir: (n, g) => (n === 1 ? `1 unidad (~${entero(g)}g)` : `${entero(n)} unidades (~${entero(g)}g)`),
  },
  {
    id: 'filete-ternera',
    coincide: (t) => /\bfiletes?\b/.test(t) && /\bternera\b/.test(t),
    unidad: 150,
    describir: (n, g) => (n === 1 ? `1 filete (~${entero(g)}g)` : `${entero(n)} filetes (~${entero(g)}g)`),
  },
]

function cantidad(texto: string, desde: number): number {
  const antes = texto.slice(0, desde).trim().split(' ').slice(-3)
  for (let i = antes.length - 1; i >= 0; i--) {
    const p = antes[i]!
    if (p in NUMEROS) return NUMEROS[p]!
    if (/^\d+(?:\.\d+)?$/.test(p)) {
      const n = Number(p)
      if (n > 0 && n <= 50) return n
    }
  }
  return 1
}

/** Primera ración reconocida en el texto, o null si no hay medida coloquial. */
export function racionEnTexto(texto: string): RacionAplicada | null {
  const t = normalizarRacion(texto)
  if (!t) return null
  for (const regla of REGLAS_RACION) {
    if (!regla.coincide(t)) continue
    const ancla = t.match(anclaDe(regla.id))
    const n = regla.fija ? 1 : cantidad(t, ancla?.index ?? t.length)
    const gramos = r1(regla.unidad * n)
    return { gramos, serving_description: regla.describir(n, gramos) }
  }
  return null
}

function anclaDe(id: string): RegExp {
  switch (id) {
    case 'media-barra':
      return /\bmedia barra\b/
    case 'plato-hondo':
      return /\bplato hondo\b/
    case 'punado':
      return /\bpunados?\b|\bpunao\b|\bpunaos\b/
    case 'cucharada-aceite':
      return /\bcucharadas?\b/
    case 'vaso-leche':
      return /\b(vaso|taza|vasos|tazas)\b/
    case 'lata-atun':
      return /\blatas?\b/
    case 'platano':
      return /\bplatanos?\b/
    case 'huevo':
      return /\bhuevos?\b/
    default:
      return /\bfiletes?\b/
  }
}

type Macro = 'calorias' | 'proteinas' | 'carbohidratos' | 'grasas'

function escalarCampo(valor: number | undefined, origen: number, destino: number): number | undefined {
  if (valor === undefined || !(origen > 0)) return valor
  return r1(valor * (destino / origen))
}

const PISTAS: Record<string, string[]> = {
  'media-barra': ['pan', 'barra'],
  'plato-hondo': ['plato'],
  punado: ['punado', 'punao'],
  'cucharada-aceite': ['aceite'],
  'vaso-leche': ['leche'],
  'lata-atun': ['atun'],
  platano: ['platano'],
  huevo: ['huevo'],
  'filete-ternera': ['ternera', 'filete'],
}

function afin(regla: Regla, nombre: string): boolean {
  return (PISTAS[regla.id] ?? []).some((p) => nombre.includes(p))
}

function clausulas(texto: string): string[] {
  return normalizarRacion(texto)
    .split(/\s+y\s+|,| con /)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Elige la ración del ingrediente, no la de otro alimento de la misma frase. */
function racionDelIngrediente(nombre: string, consulta: string | undefined, descripcion: string, unico: boolean): RacionAplicada | null {
  const pista = normalizarRacion(nombre)
  const fuentes = [`${consulta ?? ''} ${nombre}`]
  const palabras = pista.split(' ').filter((w) => w.length >= 4)
  const trozos = clausulas(`${consulta ?? ''} ${descripcion}`).filter((c) => palabras.some((w) => c.includes(w)))
  if (unico) fuentes.push(descripcion)
  else fuentes.push(...trozos)
  for (const fuente of fuentes) {
    const t = normalizarRacion(fuente)
    const reglas = REGLAS_RACION.filter((r) => r.coincide(t))
    const regla = reglas.find((r) => afin(r, pista)) ?? (reglas.length === 1 ? reglas[0] : undefined)
    if (!regla) continue
    const ancla = t.match(anclaDe(regla.id))
    const n = regla.fija ? 1 : cantidad(t, ancla?.index ?? t.length)
    const gramos = r1(regla.unidad * n)
    return { gramos, serving_description: regla.describir(n, gramos) }
  }
  return null
}

/** Sustituye 100 g arbitrarios por la ración de la tabla y escala los macros. */
export function aplicarRaciones(descripcion: string, resultado: ResultadoAnalisis): ResultadoAnalisis {
  const unico = resultado.ingredientes.length === 1
  const ingredientes = resultado.ingredientes.map((i) => {
    const racion = racionDelIngrediente(i.display_name || i.nombre, i.input_query, descripcion, unico)
    if (!racion) return i
    if (Math.abs(i.gramos - racion.gramos) < 0.5) return { ...i, serving_description: racion.serving_description }
    const origen = i.gramos
    return {
      ...i,
      gramos: racion.gramos,
      serving_description: racion.serving_description,
      calorias: escalarCampo(i.calorias, origen, racion.gramos),
      proteinas: escalarCampo(i.proteinas, origen, racion.gramos),
      carbohidratos: escalarCampo(i.carbohidratos, origen, racion.gramos),
      grasas: escalarCampo(i.grasas, origen, racion.gramos),
    }
  })
  const suma = (m: Macro) => (ingredientes.every((i) => i[m] !== undefined) && ingredientes.length > 0 ? r1(ingredientes.reduce((a, i) => a + (i[m] ?? 0), 0)) : resultado[m])
  return { ...resultado, ingredientes, calorias: suma('calorias'), proteinas: suma('proteinas'), carbohidratos: suma('carbohidratos'), grasas: suma('grasas') }
}
