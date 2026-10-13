/** Miniatura del diario: foto real si existe; si no, emoji por alimento y categoría. */

export type CategoriaPlato =
  | 'lacteo'
  | 'carne'
  | 'pescado_marisco'
  | 'fruta'
  | 'verdura'
  | 'legumbre_cereal'
  | 'panaderia'
  | 'bebida'
  | 'plato_elaborado'
  | 'snack'

const CATEGORIAS = new Set<CategoriaPlato>([
  'lacteo',
  'carne',
  'pescado_marisco',
  'fruta',
  'verdura',
  'legumbre_cereal',
  'panaderia',
  'bebida',
  'plato_elaborado',
  'snack',
])

export function esCategoriaPlato(v: string | null | undefined): v is CategoriaPlato {
  return !!v && CATEGORIAS.has(v as CategoriaPlato)
}

/** Foto subida: data URL, blob local o archivo de /api/archivos. https también vale. */
export function esFotoReal(url: string | null | undefined): url is string {
  if (!url) return false
  const u = url.trim()
  return u.startsWith('data:image/') || u.startsWith('blob:') || u.startsWith('/api/archivos/') || u.startsWith('https://')
}

/** Palabras en inglés → su equivalente en las reglas (que están en español). */
const INGLES: readonly [RegExp, string][] = [
  [/\bscrambled eggs?\b/g, 'revuelto'], [/\bfrench fries\b|\bfries\b/g, 'patatas fritas'], [/\bomel(?:e)?tt?e?s?\b/g, 'tortilla'],
  [/\bburgers?\b|\bcheeseburgers?\b/g, 'hamburguesa'], [/\bsalads?\b/g, 'ensalada'], [/\brice\b/g, 'arroz'], [/\bchicken\b/g, 'pollo'],
  [/\bbeef\b|\bsteaks?\b/g, 'ternera'], [/\bpork\b/g, 'cerdo'], [/\bturkey\b/g, 'pavo'], [/\blamb\b/g, 'cordero'], [/\bmeat\b/g, 'carne'], [/\bham\b/g, 'jamon'],
  [/\bfish\b/g, 'pescado'], [/\btuna\b/g, 'atun'], [/\bcod\b/g, 'bacalao'], [/\bshrimps?\b|\bprawns?\b/g, 'gambas'],
  [/\beggs?\b/g, 'huevo'], [/\bmilk\b|\bmilkshakes?\b/g, 'leche'], [/\bcheese\b/g, 'queso'], [/\bbutter\b/g, 'mantequilla'], [/\bhoney\b|\bjam\b/g, 'miel'],
  [/\bbread\b|\btoasts?\b/g, 'pan'], [/\bapples?\b/g, 'manzana'], [/\boranges?\b/g, 'naranja'], [/\bstrawberr(?:y|ies)\b/g, 'fresa'], [/\bgrapes?\b/g, 'uvas'], [/\bfruits?\b|\bpears?\b/g, 'fruta'],
  [/\bcoffee\b|\blatte\b/g, 'cafe'], [/\btea\b/g, 'te'], [/\bjuice\b/g, 'zumo'], [/\bwater\b/g, 'agua'], [/\bbeer\b/g, 'cerveza'], [/\bwine\b/g, 'vino'],
  [/\bsoups?\b|\bstews?\b/g, 'sopa'], [/\bpotato(?:es)?\b/g, 'patata'], [/\bbeans\b/g, 'alubias'], [/\blentils\b/g, 'lentejas'], [/\bchickpeas\b/g, 'garbanzos'],
  [/\bcookies?\b|\bbiscuits?\b/g, 'galleta'], [/\boat(?:s|meal)\b/g, 'avena'], [/\bspaghetti\b/g, 'espaguetis'], [/\bvegetables?\b|\bveggies\b/g, 'verduras'], [/\bbroccoli\b/g, 'brocoli'],
  [/\bsandwich(?:es)?\b/g, 'sandwich'], [/\bdoughnuts?\b/g, 'donut'],
]

function plano(s: string): string {
  let t = s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  for (const [re, es] of INGLES) t = t.replace(re, es)
  return t
}

/** Un único emoji (pictograma) corto; descarta texto o secuencias raras. */
export function esEmojiValido(e: unknown): e is string {
  return typeof e === 'string' && e.length > 0 && e.length <= 16 && /^\p{Extended_Pictographic}/u.test(e) && !/[\p{L}\p{N}\s]/u.test(e.replace(/\uFE0F|\u200D/g, ''))
}

export const EMOJI_RESPALDO = '🍽️'

/** Emoji guardado si es válido; si no, el deducido por nombre, categoría o macros. */
export function emojiDe(c: Parameters<typeof emojiComida>[0] & { emoji?: string | null }): string {
  return esEmojiValido(c.emoji) ? c.emoji : emojiComida(c)
}

/** Emoji por texto (búsqueda, código de barras, entrada manual), con respaldo 🍽️. */
export function emojiPorTexto(texto: string, categoria?: string | null): string {
  return emojiDeTexto(plano(texto)) || (esCategoriaPlato(categoria) ? POR_CATEGORIA[categoria] : EMOJI_RESPALDO)
}

/** Selección para el selector de emoji. */
export const EMOJIS_COMIDA = ['🍕','🥗','🍔','🍝','🍣','🍳','🥩','🍗','🐟','🦐','🍚','🍜','🍲','🥪','🌯','🌮','🍟','🥔','🥦','🥕','🍎','🍌','🍊','🍓','🍇','🥑','🍞','🥐','🥣','🥞','🧀','🥛','☕','🧃','🥤','🍫','🍪','🍩','🍰','🍦','🥜','🫘','🍽️'] as const

/**
 * `plato` gana aunque la palabra vaya después de un ingrediente
 * («pan de hamburguesa» es 🍔, no 🍞). Si no hay plato, gana la palabra
 * que aparece antes.
 */
const REGLAS: readonly { re: RegExp; emoji: string; plato?: boolean }[] = [
  { re: /\b(cafes?|cappuccino|capuchino|cortado|expreso|espresso|americano|te|infusion|infusiones|manzanilla|rooibos|matcha|colacao|nesquik)\b/, emoji: '☕', plato: true },
  { re: /\b(zumos?|jugos?|nectar|smoothie)\b/, emoji: '🧃', plato: true },
  { re: /\b(refrescos?|sodas?|cola|fanta|nestea|monster|cerveza|vino|kombucha|bebida energetica|agua|horchata)\b/, emoji: '🥤', plato: true },
  { re: /\b(churros?|porras?|donuts?|rosquillas?|berlinas?)\b/, emoji: '🍩', plato: true },
  { re: /\b(gofres?|waffles?)\b/, emoji: '🧇', plato: true },
  { re: /\b(tortitas?|pancakes?|crepes?|hotcakes?)\b/, emoji: '🥞', plato: true },
  { re: /\b(cereales|muesli|granola|porridge|gachas|avena)\b/, emoji: '🥣', plato: true },
  { re: /\b(cruasan|cruas|croissant|napolitanas?|palmeras?|ensaimadas?|medialunas?|bizcochos?|sobaos?|bollos?|magdalenas?|brioche)\b/, emoji: '🥐', plato: true },
  { re: /\b(hamburguesas?|burgers?)\b/, emoji: '🍔', plato: true },
  { re: /\b(bocadillos?|bocata|bocatas|sandwiches|sandwich|montaditos?|bikini)\b|\bmixto integral\b|\bsandwich mixto\b/, emoji: '🥪', plato: true },
  { re: /\b(kebab|durum|shawarma|wraps?|burritos?)\b/, emoji: '🌯', plato: true },
  { re: /\b(tacos?)\b/, emoji: '🌮', plato: true },
  { re: /\b(sushi|makis?|nigiri)\b/, emoji: '🍣', plato: true },
  { re: /\b(empanadas?|empanadillas?)\b/, emoji: '🥟', plato: true },
  { re: /\b(caldo|sopas?|consome|guisos?|estofado|cocido|gazpacho|salmorejo|croquetas?|albondigas?)\b/, emoji: '🍲', plato: true },
  { re: /\b(pizzas?)\b/, emoji: '🍕', plato: true },
  { re: /\b(tortillas?|revuelto)\b/, emoji: '🍳', plato: true },
  { re: /\b(ensaladas?|poke)\b/, emoji: '🥗', plato: true },
  { re: /\b(ramen|fideua)\b/, emoji: '🍜', plato: true },
  { re: /\b(gambas?|langostinos?|camarones|camaron|cigalas?)\b/, emoji: '🦐' },
  { re: /\b(pescados?|mariscos?|salmon|atun|merluza|bacalao|sardinas?|lubina|dorada|bonito|trucha|pulpo|mejillones|mejillon|calamares|calamar)\b/, emoji: '🐟' },
  { re: /\b(ternera|vacuno|buey|res|pollo|pechugas?|cerdo|pavo|cordero|carne|jamon(?:es)?|bacon|beicon|filetes?|lomos?|chorizos?|salchichas?|costillas?)\b/, emoji: '🥩' },
  { re: /\b(manzanas?|apple)\b/, emoji: '🍎' },
  { re: /\b(platanos?|bananas?)\b/, emoji: '🍌' },
  { re: /\b(naranjas?|mandarinas?)\b/, emoji: '🍊' },
  { re: /\b(fresas?|freson)\b/, emoji: '🍓' },
  { re: /\b(uvas?)\b/, emoji: '🍇' },
  { re: /\b(frutas?|peras?|kiwis?|melon|sandia|pina|mangos?|melocoton)\b/, emoji: '🍎' },
  { re: /\b(patatas fritas|chips)\b/, emoji: '🍟' },
  { re: /\b(patatas?|papas?|pure)\b/, emoji: '🥔' },
  { re: /\b(arroz|paella|risotto|cuscus|quinoa)\b/, emoji: '🍚' },
  { re: /\b(pasta|espaguetis?|macarrones|macarron|tallarines|tallarin|fideos?|lasana|noodles)\b/, emoji: '🍝' },
  { re: /\b(mantequilla|margarina)\b/, emoji: '🧈' },
  { re: /\b(miel|mermelada|confitura)\b/, emoji: '🍯' },
  { re: /\b(quesos?)\b/, emoji: '🧀' },
  { re: /\b(yogur(?:es)?|yogurt|kefir|leche|batidos?|cacaolat|protein shake|high protein|proteinas? liquidas?|bebidas? proteicas?|bebidas? de (?:cacao|avena|soja|almendras?))\b/, emoji: '🥛' },
  { re: /\b(panes|pan|tostadas?|bagel|hogaza)\b/, emoji: '🍞' },
  { re: /\b(huevos?)\b/, emoji: '🍳' },
  { re: /\b(brocoli|verduras?|lechuga|espinacas?)\b/, emoji: '🥦' },
  { re: /\b(lentejas?|garbanzos?|alubias?|judias?|legumbres?)\b/, emoji: '🫘' },
  { re: /\b(tomates?|tomate triturado)\b/, emoji: '🍅' },
  { re: /\b(chocolate|nutella|nocilla|crema de cacao)\b/, emoji: '🍫' },
  { re: /\b(galletas?|snacks?|barritas?)\b/, emoji: '🍪' },
]

const POR_CATEGORIA: Record<CategoriaPlato, string> = {
  lacteo: '🥛',
  carne: '🥩',
  pescado_marisco: '🐟',
  fruta: '🍎',
  verdura: '🥦',
  legumbre_cereal: '🍚',
  panaderia: '🍞',
  bebida: '🥤',
  plato_elaborado: '🍽️',
  snack: '🍪',
}

/** Emoji de respaldo cuando ni el nombre ni la categoría dicen qué es. */
export function emojiMacro(m: { proteinas: number; carbohidratos: number; grasas: number }): string {
  const p = m.proteinas * 4
  const c = m.carbohidratos * 4
  const g = m.grasas * 9
  if (p >= c && p >= g) return '🥩'
  if (c >= g) return '🍚'
  return '🥑'
}

function emojiDeTexto(texto: string): string {
  let platoIndice = Number.POSITIVE_INFINITY
  let platoEmoji = ''
  let mejorIndice = Number.POSITIVE_INFINITY
  let mejorOrden = Number.POSITIVE_INFINITY
  let mejorEmoji = ''
  for (let orden = 0; orden < REGLAS.length; orden++) {
    const regla = REGLAS[orden]
    if (!regla) continue
    const hallado = regla.re.exec(texto)
    if (!hallado) continue
    if (regla.plato && hallado.index < platoIndice) {
      platoIndice = hallado.index
      platoEmoji = regla.emoji
    }
    if (hallado.index < mejorIndice || (hallado.index === mejorIndice && orden < mejorOrden)) {
      mejorIndice = hallado.index
      mejorOrden = orden
      mejorEmoji = regla.emoji
    }
  }
  return platoEmoji || mejorEmoji
}

export function emojiComida(c: {
  descripcion?: string
  categoria?: string | null
  ingredientes?: readonly { nombre?: string }[]
  proteinas?: number
  carbohidratos?: number
  grasas?: number
}): string {
  const texto = plano([c.descripcion ?? '', ...(c.ingredientes ?? []).map((i) => i.nombre ?? '')].join(' '))
  const e = emojiDeTexto(texto)
  if (e) return e
  if (esCategoriaPlato(c.categoria)) return POR_CATEGORIA[c.categoria]
  return emojiMacro({
    proteinas: c.proteinas ?? 0,
    carbohidratos: c.carbohidratos ?? 0,
    grasas: c.grasas ?? 0,
  })
}
