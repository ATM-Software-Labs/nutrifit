/**
 * Título gastronómico del plato. `alimento` no es una lista de ingredientes:
 * el desglose queda en `descripcion` y la categoría es uno de los diez valores.
 */
export const CATEGORIAS_PLATO = [
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
] as const

export type CategoriaPlato = (typeof CATEGORIAS_PLATO)[number]

export const MAX_ALIMENTO = 40
const MAX_DESCRIPCION = 200

const RE_BEBIDA = /\b(cafe|cappuccino|capuchino|cortado|expreso|espresso|americano|te|infusion|manzanilla|rooibos|matcha|zumo|jugo|nectar|smoothie|refresco|soda|cola|fanta|nestea|cerveza|vino|kombucha|monster|agua|bebida)\b/
const RE_ELABORADO = /\b(hamburgues|burger|sandwich|bocadillo|bocata|montadito|guiso|estofado|paella|pizza|taco|ensalada|wrap|burrito|lasana|cocido|wok)\b/
const RE_PESCADO = /\b(pescados?|mariscos?|gambas?|langostinos?|camarones|camaron|cigalas?|salmon|atun|merluza|bacalao|sardinas?|lubina|dorada|bonito|trucha|pulpo|mejillones|mejillon|calamares|calamar|fish|shrimps?|prawns?|tuna)\b/
const RE_CARNE = /\b(ternera|vacuno|buey|res|pollo|pechuga|cerdo|pavo|cordero|carne|jamon|bacon|beicon|filete|lomo|chorizo|salchicha|costilla|beef|chicken|steak|pork)\b/
const RE_FRUTA = /\b(fruta|manzana|platano|banana|naranja|fresa|pera|kiwi|melon|sandia|uva|pina|mango|melocoton|cereza|apple)\b/
const RE_VERDURA = /\b(verdura|lechuga|tomate|brocoli|calabacin|espinaca|zanahoria|pepino|pimiento|cebolla)\b/
const RE_PAN = /\b(panes|pan|tostadas?|cruasan|cruas|croissant|bollos?|magdalenas?|brioche|panaderia|bagel|hogaza)\b/
const RE_LACTEO = /\b(lacteo|leche|queso|yogur|yogurt|kefir|mantequilla|nata|requeson)\b/
const RE_CEREAL = /\b(arroz|pasta|espaguetis?|macarrones|macarron|tallarines|tallarin|avena|cereal|quinoa|lentejas?|garbanzos?|alubias?|judias?|legumbres?|patatas?|papas?|rice|fideos?|lasana)\b/
const RE_SNACK = /\b(snack|galleta|chocolate|chips|barrita|frutos secos|nueces|almendra)\b/
const RE_ACCESORIO = /^(aceite|sal|pimienta|vinagre|agua|azucar|oregano|comino)\b/

export function plano(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

export function esCategoriaPlato(v: string): v is CategoriaPlato {
  return (CATEGORIAS_PLATO as readonly string[]).includes(v)
}

function capitalizar(s: string): string {
  const t = s.replace(/\s+/g, ' ').trim()
  if (!t) return ''
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/** Corta en un espacio y no deja una preposición colgando. */
export function recortarTitulo(s: string, max = MAX_ALIMENTO): string {
  const limpio = s.replace(/\s+/g, ' ').trim()
  if (limpio.length <= max) return limpio
  let corte = limpio.slice(0, max)
  const espacio = corte.lastIndexOf(' ')
  if (espacio >= 18) corte = corte.slice(0, espacio)
  return corte.replace(/[\s,;:.\-]+$/g, '').replace(/\s+(de|con|y|a|al|del|la|el|en|para)$/i, '')
}

function recortarTexto(s: string, max: number): string {
  const limpio = s.replace(/\s+/g, ' ').trim()
  if (limpio.length <= max) return limpio
  const corte = limpio.slice(0, max)
  const espacio = corte.lastIndexOf(' ')
  return (espacio >= max - 24 ? corte.slice(0, espacio) : corte).replace(/[\s,;]+$/g, '')
}

export function limpiarFragmento(s: string): string {
  return s
    .replace(/\s+para\b.*$/i, '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Lista separada por comas o punto y coma. Un título con «y» no se parte. */
export function partirLista(nombre: string): string[] | null {
  if (!/[,;]/.test(nombre)) return null
  const partes = nombre.split(/[,;]/).map(limpiarFragmento).filter((s) => s.length > 1)
  return partes.length >= 2 ? partes : null
}

function proteinaDe(t: string): 'ternera' | 'pollo' | 'cerdo' | 'pavo' | 'cordero' | 'pescado' | null {
  if (/ternera|vacuno|\bbuey\b|carne de res|\bres\b/.test(t)) return 'ternera'
  if (/pollo|pechuga/.test(t)) return 'pollo'
  if (/cerdo|\bjamon\b|bacon|beicon/.test(t)) return 'cerdo'
  if (/\bpavo\b/.test(t)) return 'pavo'
  if (/cordero/.test(t)) return 'cordero'
  if (/atun|salmon|merluza|pescado|gamba|langostino/.test(t)) return 'pescado'
  return null
}

function relevantes(nombres: string[]): string[] {
  const limpios = nombres.map(limpiarFragmento).filter((s) => s.length > 1)
  const sinAccesorio = limpios.filter((s) => !RE_ACCESORIO.test(plano(s)))
  return sinAccesorio.length ? sinAccesorio : limpios
}

/** Nombre de plato a partir de una lista de ingredientes. Nunca devuelve comas. */
export function sintetizarPlato(nombres: string[]): string {
  const piezas = relevantes(nombres)
  const t = plano(piezas.join(' '))
  const proteina = proteinaDe(t)
  const integral = /integral/.test(t) ? ' integral' : ''

  if (/hamburgues|burger|pan de hamburguesa/.test(t)) {
    const de = proteina ? ` de ${proteina}` : ''
    return recortarTitulo(`Hamburguesa completa${de}`)
  }

  const rellenoPan = /jamon|queso|atun|tortilla|pechuga|lomo|bacon|beicon/.test(t)
  if (/sandwich|bocadillo|bocata|montadito|\bmixto\b/.test(t) || (/\bpan\b/.test(t) && rellenoPan && !/hamburgues|burger/.test(t))) {
    if (/mixto/.test(t) || (/jamon/.test(t) && /queso/.test(t))) return recortarTitulo(`Sándwich mixto${integral}`)
    if (/atun/.test(t)) return recortarTitulo(`Sándwich de atún${integral}`)
    if (/tortilla/.test(t)) return recortarTitulo(`Bocadillo de tortilla${integral}`)
    if (/pechuga|pollo/.test(t)) return recortarTitulo(`Sándwich de pollo${integral}`)
    if (/jamon/.test(t)) return recortarTitulo(`Sándwich de jamón${integral}`)
    if (/queso/.test(t)) return recortarTitulo(`Sándwich de queso${integral}`)
    return recortarTitulo(`Sándwich${integral}`)
  }

  if (/tortilla/.test(t) || (/\bhuevo/.test(t) && /patata/.test(t))) return 'Tortilla de patatas'

  if (/guiso|estofado|cocido/.test(t) || (/patata/.test(t) && /zanahoria|verdura|guisante|calabacin|pimiento|cebolla/.test(t) && (proteina !== null || /carne/.test(t)))) {
    if (proteina === 'pollo') return 'Guiso de pollo con patatas y verduras'
    if (proteina === 'cerdo') return 'Guiso de cerdo con patatas y verduras'
    if (proteina === 'pescado') return 'Guiso de pescado con patatas'
    return 'Guiso de carne con patatas y verduras'
  }

  if (/ensalada/.test(t)) {
    if (proteina === 'pollo') return 'Ensalada de pollo'
    if (proteina === 'pescado') return 'Ensalada de pescado'
    if (/queso/.test(t)) return 'Ensalada de queso'
    return 'Ensalada'
  }

  if (/paella/.test(t)) return /marisco|gamba|pescado/.test(t) ? 'Paella de marisco' : 'Paella'
  if (/arroz/.test(t)) {
    if (proteina === 'pollo') return 'Arroz con pollo'
    if (proteina === 'pescado') return 'Arroz con pescado'
    if (/verdura|calabacin|pimiento/.test(t)) return 'Arroz con verduras'
    return 'Arroz'
  }
  if (/pasta|espagueti|macarron|tallarin|fideo|lasana/.test(t)) {
    if (/bolonesa|ternera|carne picada|\bcarne\b/.test(t)) return 'Pasta a la boloñesa'
    if (proteina) return recortarTitulo(`Pasta con ${proteina}`)
    return 'Pasta'
  }
  if (/pizza/.test(t)) return 'Pizza'
  if (/\btacos?\b/.test(t)) return proteina ? recortarTitulo(`Tacos de ${proteina}`) : 'Tacos'

  const [a, b] = piezas
  if (a && b) {
    const candidato = `${capitalizar(a)} con ${b.charAt(0).toLowerCase()}${b.slice(1)}`
    if (!candidato.includes(',') && candidato.length <= MAX_ALIMENTO) return candidato
    return recortarTitulo(capitalizar(a))
  }
  return recortarTitulo(capitalizar(a || 'Plato'))
}

/** Título de como máximo 40 caracteres. Una lista separada por comas se sintetiza. */
export function tituloGastronomico(nombre: string, ingredientes: string[] = []): string {
  const base = nombre.replace(/\s+/g, ' ').trim()
  const lista = base ? partirLista(base) : null
  if (!lista) {
    if (!base && ingredientes.length >= 2) {
      const titulo = sintetizarPlato(ingredientes)
      return titulo || 'Plato'
    }
    const suelto = base || ingredientes.map(limpiarFragmento).find((s) => s.length > 1) || 'Plato'
    const titulo = recortarTitulo(capitalizar(suelto))
    return titulo || 'Plato'
  }
  const piezas = [...lista, ...ingredientes.map(limpiarFragmento).filter((s) => s.length > 1)]
  const titulo = sintetizarPlato(piezas)
  return titulo || 'Plato'
}

/** Desglose secundario. Vacío cuando no añade nada al título. */
export function descripcionPlato(nombreCrudo: string, ingredientes: string[], descripcionModelo = ''): string {
  const titulo = tituloGastronomico(nombreCrudo, ingredientes)
  const modelo = descripcionModelo.replace(/\s+/g, ' ').trim()
  if (modelo && plano(modelo) !== plano(titulo)) return recortarTexto(modelo, MAX_DESCRIPCION)
  const lista = partirLista(nombreCrudo)
  const fuente = ingredientes.length ? ingredientes : (lista ?? [])
  const detalle = fuente.map(limpiarFragmento).filter((s) => s.length > 1 && plano(s) !== plano(titulo))
  if (detalle.length >= 1 && (detalle.length >= 2 || lista)) return recortarTexto(detalle.join(', '), MAX_DESCRIPCION)
  return ''
}

export function categoriaDe(textos: string[], nIngredientes: number): CategoriaPlato {
  const t = plano(textos.filter(Boolean).join(' '))
  if (RE_BEBIDA.test(t) && !RE_ELABORADO.test(t)) return 'bebida'
  if (RE_ELABORADO.test(t) || nIngredientes >= 3) return 'plato_elaborado'
  if (nIngredientes >= 2 && RE_PAN.test(t) && (RE_CARNE.test(t) || RE_LACTEO.test(t) || RE_PESCADO.test(t))) return 'plato_elaborado'
  if (nIngredientes >= 2 && RE_CARNE.test(t) && (RE_CEREAL.test(t) || RE_VERDURA.test(t))) return 'plato_elaborado'
  if (RE_PESCADO.test(t)) return 'pescado_marisco'
  if (RE_CARNE.test(t)) return 'carne'
  if (RE_FRUTA.test(t) && !RE_PAN.test(t)) return 'fruta'
  if (RE_VERDURA.test(t)) return 'verdura'
  if (RE_PAN.test(t)) return 'panaderia'
  if (RE_LACTEO.test(t)) return 'lacteo'
  if (RE_CEREAL.test(t)) return 'legumbre_cereal'
  if (RE_SNACK.test(t)) return 'snack'
  return 'plato_elaborado'
}
