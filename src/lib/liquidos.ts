/**
 * Líquidos frente a sólidos: unidades (ml/cl/l/fl oz), detección por los
 * campos de Open Food Facts, la etiqueta o USDA, y cantidades rápidas
 * (envase entero, medio, porción, vaso). Compartido por servidor y cliente.
 * Los macros de un líquido son por 100 ml; sin densidad conocida, 1 ml ≈ 1 g
 * solo para las sumas internas.
 */
export type UnidadBase = 'g' | 'ml'
export type UnidadVolumen = 'ml' | 'cl' | 'l'

const FACTOR: Record<string, [number, UnidadBase]> = {
  mg: [0.001, 'g'], g: [1, 'g'], gr: [1, 'g'], grs: [1, 'g'], gramos: [1, 'g'], kg: [1000, 'g'], oz: [28.35, 'g'],
  ml: [1, 'ml'], cl: [10, 'ml'], dl: [100, 'ml'], l: [1000, 'ml'], lt: [1000, 'ml'], litro: [1000, 'ml'], litros: [1000, 'ml'], 'fl oz': [29.5735, 'ml'], floz: [29.5735, 'ml'],
}

/** "275 ml", "33 cl", "1,5 l", "6 x 33 cl", "12 fl oz", "500g" → cantidad en g o ml (la última medida; en packs, la unidad). */
export function parsearMedida(texto: string | null | undefined): { cantidad: number; unidad: UnidadBase; unidades: number | null } | null {
  if (!texto) return null
  const t = String(texto).toLowerCase().replace(/(\d),(\d)/g, '$1.$2').replace(/fl\.?\s*oz/g, 'fl oz')
  const re = /(\d+(?:\.\d+)?)\s*(fl oz|floz|litros?|kg|mg|grs?|gramos|g|ml|cl|dl|lt|l|oz)(?![a-z])/g
  const ms = [...t.matchAll(re)]
  if (!ms.length) return null
  const multi = t.match(/(\d{1,3})\s*[x×]\s*\d/)
  const m = multi ? ms[0]! : ms.at(-1)!
  const [f, u] = FACTOR[m[2]!]!
  const c = Math.round(Number(m[1]) * f * 10) / 10
  if (!(c > 0 && c <= 20_000)) return null
  return { cantidad: c, unidad: u, unidades: multi ? Number(multi[1]) : null }
}

const RE_CATEGORIA_LIQUIDO = /(^|:)(beverages?|drinks?|waters?|mineral-waters|spring-waters|juices?|fruit-juices|nectars|sodas|soft-drinks|colas|milks?|dairy-drinks|milk-drinks|flavoured-milks|plant-based-milks|plant-milks|teas?|iced-teas|coffee-drinks|energy-drinks|sports-drinks|smoothies|kefirs|drinkable-yogurts|beers|wines|alcoholic-beverages|broths|soups)$/
const RE_NO_LIQUIDO = /(^|:)(dried|powders?|instant|chocolate-powders|cocoa-powders|coffee-beans|ground-coffees|tea-bags|syrups-concentrate)/
const RE_NOMBRE_LIQUIDO = /\b(agua|water|zumo|jugo|juice|refresco|soda|cola|leche|milk|batido|bebida|drink|t[eé] fr[ií]o|kombucha|kefir l[ií]quido|cerveza|beer|vino|wine|caldo|smoothie|n[eé]ctar|horchata|isot[oó]nic[oa]|energ[eé]tica)\b/i

export interface DatosLiquido {
  unidadDeclarada?: string | null
  cantidad?: string | null
  porNutricion?: string | null
  categorias?: readonly string[] | null
  nombre?: string | null
  unidadRacion?: string | null
}

/** ¿Es un líquido? Prioridad: unidad declarada → «por 100 ml» → cantidad en ml → categorías → nombre. */
export function esLiquido(d: DatosLiquido): boolean {
  const u = (d.unidadDeclarada ?? '').toLowerCase().trim()
  if (u === 'ml' || u === 'cl' || u === 'l') return true
  if (u === 'g' || u === 'kg') return false
  const por = (d.porNutricion ?? '').toLowerCase().replace(/\s/g, '')
  if (por.endsWith('ml')) return true
  if (por.endsWith('g')) {
    /* OFF pone «100g» por defecto también en bebidas: sigue mirando */
  }
  const ru = (d.unidadRacion ?? '').toLowerCase().trim()
  if (ru === 'ml' || ru === 'mlt' || ru === 'l' || ru === 'fl oz') return true
  const med = parsearMedida(d.cantidad)
  if (med) return med.unidad === 'ml'
  const cats = d.categorias ?? []
  if (cats.some((c) => RE_NO_LIQUIDO.test(c))) return false
  if (cats.some((c) => RE_CATEGORIA_LIQUIDO.test(c))) return true
  return !!d.nombre && RE_NOMBRE_LIQUIDO.test(d.nombre)
}

/** Agua, infusiones y bebidas sin calorías: cuentan para el objetivo de agua por defecto. */
export function cuentaComoAgua(nombre: string, kcalPor100: number): boolean {
  if (/\b(agua|water|infusi[oó]n|manzanilla|poleo|rooibos|t[eé]\b|tila|herbal)/i.test(nombre) && kcalPor100 <= 5) return true
  return kcalPor100 <= 1
}

export const A_ML: Record<UnidadVolumen, number> = { ml: 1, cl: 10, l: 1000 }
export const aMl = (valor: number, u: UnidadVolumen) => Math.round(valor * A_ML[u] * 10) / 10
export const desdeMl = (ml: number, u: UnidadVolumen) => Math.round((ml / A_ML[u]) * 1000) / 1000

/** «275 ml», «1,5 l», «33 cl» para mostrar. */
export function formatoCantidad(c: number, u: UnidadBase): string {
  const r = (x: number) => (Math.round(x * 10) / 10).toLocaleString('es-ES')
  if (u === 'ml' && c >= 1000) return `${r(c / 1000)} l`
  return `${r(c)} ${u}`
}

export interface OpcionRapida { clave: 'envase' | 'medio' | 'porcion' | 'vaso' | 'unidad'; etiqueta: string; cantidad: number }

/** Botones de cantidad rápida según el producto. */
export function opcionesRapidas(p: { unidad: UnidadBase; envase: number | null; racion: number | null; unidades?: number | null }): OpcionRapida[] {
  const o: OpcionRapida[] = []
  const liq = p.unidad === 'ml'
  if (p.envase) {
    o.push({ clave: 'envase', etiqueta: `${liq ? 'Envase entero' : 'Paquete entero'} (${formatoCantidad(p.envase, p.unidad)})`, cantidad: p.envase })
    const racionReal = p.racion && p.racion !== p.envase ? p.racion : null
    if (!racionReal || p.envase >= 2 * racionReal) o.push({ clave: 'medio', etiqueta: `½ ${liq ? 'envase' : 'paquete'} (${formatoCantidad(p.envase / 2, p.unidad)})`, cantidad: Math.round(p.envase / 2 * 10) / 10 })
  }
  if (p.racion && p.racion !== p.envase) o.push({ clave: 'porcion', etiqueta: `${liq ? 'Una porción' : 'Una unidad/porción'} (${formatoCantidad(p.racion, p.unidad)})`, cantidad: p.racion })
  if (liq && p.envase !== 250 && p.racion !== 250) o.push({ clave: 'vaso', etiqueta: 'Un vaso (250 ml)', cantidad: 250 })
  return o
}
