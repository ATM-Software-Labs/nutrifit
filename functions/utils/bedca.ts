/**
 * Consulta en vivo de BEDCA (Base de Datos Española de Composición de Alimentos,
 * AESAN) por su interfaz pública XML. No se versiona el volcado: cada búsqueda
 * pide solo el alimento que hace falta.
 *
 * Sirve de respaldo para carnes, pescados, frutas y verduras no envasadas
 * (pescadilla, plátano de Canarias, pechuga de pollo de corral). Los valores
 * salen por 100 g de porción comestible. Lo que BEDCA no ha medido queda en null.
 */

/** Gramos (o kcal / g de sal) por 100 g. null = el componente no está medido. */
export interface Nutrientes {
  energia_kcal: number | null
  proteinas: number | null
  carbohidratos: number | null
  azucares: number | null
  grasas: number | null
  grasas_saturadas: number | null
  fibra: number | null
  sal: number | null
}

const BEDCA_URL = 'https://www.bedca.net/bdpub/procquery.php'
const USER_AGENT = 'NutriFit/1.0 (soporte@trujillomingorance.com)'

/** Palabras que identifican un fresco (no una marca blanca envasada). */
const LEXICO_FRESCO = new Set([
  'pollo', 'pavo', 'ternera', 'cerdo', 'cordero', 'conejo', 'pechuga', 'muslo', 'contramuslo', 'lomo', 'filete', 'carne', 'vacuno', 'solomillo', 'costilla', 'corral',
  'pescadilla', 'merluza', 'bacalao', 'salmon', 'atun', 'sardina', 'boqueron', 'lubina', 'dorada', 'rape', 'lenguado', 'pescado', 'gamba', 'mejillon', 'calamar', 'sepia', 'pulpo', 'trucha', 'caballa', 'bonito', 'anchoa', 'pescados',
  'platano', 'canarias', 'manzana', 'naranja', 'pera', 'fresa', 'melon', 'sandia', 'uva', 'kiwi', 'mango', 'pina', 'cereza', 'ciruela', 'melocoton', 'albaricoque', 'mandarina', 'limon', 'pomelo', 'fruta', 'aguacate',
  'tomate', 'lechuga', 'cebolla', 'ajo', 'zanahoria', 'calabacin', 'berenjena', 'pimiento', 'pepino', 'espinaca', 'acelga', 'brocoli', 'coliflor', 'judia', 'guisante', 'esparrago', 'puerro', 'apio', 'col', 'repollo', 'verdura', 'hortaliza', 'patata',
])

const CUALIFICADOR = new Set(['canarias', 'corral', 'fresco', 'fresca', 'frescos', 'crudo', 'cruda', 'natural', 'ecologico', 'ecologica', 'campo'])
const PARADA = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'con', 'sin', 'y', 'en', 'al', 'por', 'tipo'])
const ENVASADO = /\b(yogur|galleta|helado|chocolate|bebida|zumo|refresco|conserva|enlatad|embutid|fiambre|snack|bolleria|natilla|flan|batido|salsa|sopa|cereal|pan)\b/
const COCCION = /\b(frit|rebozad|plancha|horno|asado|asada|cocid|hervid|guisad)\b/
const CRUDO = /\b(crudo|cruda)\b/

export const sinAcentos = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

export function tokensConsulta(q: string): string[] {
  return sinAcentos(q)
    .split(' ')
    .filter((t) => t.length >= 3 && !PARADA.has(t))
}

/** true si la consulta pide un fresco y no una cadena de supermercado. «del día» no es la marca Dia. */
export function esConsultaFresco(q: string): boolean {
  const t = sinAcentos(q)
  if (/\b(mercadona|hacendado|carrefour|caprabo|eroski|lidl)\b/.test(t)) return false
  if (/\bdia\b/.test(t) && !/\b(del|al) dia\b/.test(t)) return false
  return tokensConsulta(q).some((w) => LEXICO_FRESCO.has(w))
}

export function terminoBedca(q: string): string {
  return q
    .normalize('NFC')
    .replace(/[^\p{L}\p{N} ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40)
}

function xmlTexto(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function decodificarXml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim()
}

function campo(xml: string, nombre: string): string {
  const m = xml.match(new RegExp(`<${nombre}>([\\s\\S]*?)</${nombre}>`))
  return m ? decodificarXml(m[1]!) : ''
}

export interface FilaBedca {
  id: string
  nombre: string
}

export function parsearListaBedca(xml: string): FilaBedca[] {
  const vistos = new Set<string>()
  const salida: FilaBedca[] = []
  for (const m of xml.matchAll(/<food>([\s\S]*?)<\/food>/g)) {
    const bloque = m[1]!
    const id = campo(bloque, 'f_id')
    const nombre = campo(bloque, 'f_ori_name').replace(/\s+/g, ' ')
    if (!/^\d+$/.test(id) || !nombre || vistos.has(id)) continue
    vistos.add(id)
    salida.push({ id, nombre })
  }
  return salida
}

export interface ComponenteBedca {
  nombre: string
  valor: number | null
  unidad: string
}

export function parsearDetalleBedca(xml: string): { id: string; nombre: string; componentes: ComponenteBedca[] } | null {
  const food = xml.match(/<food>([\s\S]*?)<\/food>/)
  if (!food) return null
  const bloque = food[1]!
  const id = campo(bloque, 'f_id')
  const nombre = campo(bloque, 'f_ori_name').replace(/\s+/g, ' ')
  if (!/^\d+$/.test(id) || !nombre) return null
  const componentes: ComponenteBedca[] = []
  for (const v of bloque.matchAll(/<foodvalue>([\s\S]*?)<\/foodvalue>/g)) {
    const trozo = v[1]!
    const crudo = campo(trozo, 'best_location').replace(',', '.')
    const n = crudo === '' ? null : Number(crudo)
    componentes.push({
      nombre: campo(trozo, 'c_ori_name'),
      valor: n !== null && Number.isFinite(n) && n >= 0 ? n : null,
      unidad: campo(trozo, 'v_unit').toLowerCase(),
    })
  }
  return { id, nombre, componentes }
}

/** Elige frescos: descarta yogures y conservas, y prefiere la pieza cruda si no se pidió cocción. */
export function elegirCandidatos(consulta: string, filas: FilaBedca[]): FilaBedca[] {
  const tokens = tokensConsulta(consulta)
  const pideCoccion = COCCION.test(sinAcentos(consulta))
  const pideCrudo = CRUDO.test(sinAcentos(consulta)) || !pideCoccion
  const puntuados = filas
    .filter((f) => {
      const n = sinAcentos(f.nombre)
      if (ENVASADO.test(n) && !ENVASADO.test(sinAcentos(consulta))) return false
      return true
    })
    .map((f) => {
      const n = sinAcentos(f.nombre)
      let s = tokens.reduce((acc, t) => acc + (n.includes(t) ? 3 : 0), 0)
      if (tokens.length && tokens.every((t) => n.includes(t) || CUALIFICADOR.has(t))) s += 4
      if (pideCrudo && CRUDO.test(n)) s += 3
      if (!pideCoccion && COCCION.test(n)) s -= 4
      if (pideCoccion && COCCION.test(n)) s += 3
      return { f, s }
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.f.nombre.length - b.f.nombre.length)
  return puntuados.slice(0, 3).map((x) => x.f)
}

const VACIO: Nutrientes = {
  energia_kcal: null,
  proteinas: null,
  carbohidratos: null,
  azucares: null,
  grasas: null,
  grasas_saturadas: null,
  fibra: null,
  sal: null,
}

function componente(lista: ComponenteBedca[], pred: (nombre: string) => boolean): ComponenteBedca | null {
  return lista.find((c) => pred(sinAcentos(c.nombre))) ?? null
}

function enGramos(c: ComponenteBedca | null): number | null {
  if (!c || c.valor === null) return null
  if (c.unidad === 'mg') return c.valor / 1000
  if (c.unidad === 'ug' || c.unidad === 'µg') return c.valor / 1_000_000
  return c.valor
}

/** kJ → kcal (4,184 kJ/kcal). El sodio (mg) pasa a sal con el factor 2,5. */
export function nutrientesDesdeBedca(componentes: ComponenteBedca[]): Nutrientes {
  const n: Nutrientes = { ...VACIO }
  const energia = componente(componentes, (x) => x.startsWith('energia'))
  if (energia?.valor !== null && energia?.valor !== undefined) {
    const kcal = energia.unidad === 'kj' ? energia.valor / 4.184 : energia.valor
    n.energia_kcal = kcal
  }
  n.proteinas = enGramos(componente(componentes, (x) => x.startsWith('proteina')))
  n.carbohidratos = enGramos(componente(componentes, (x) => x === 'carbohidratos' || x.startsWith('carbohidratos ')))
  n.azucares = enGramos(componente(componentes, (x) => x.startsWith('azucar')))
  n.grasas = enGramos(componente(componentes, (x) => x.startsWith('grasa total') || x.startsWith('grasa,')))
  n.grasas_saturadas = enGramos(componente(componentes, (x) => x.includes('saturad') && !x.includes('monoinsatur') && !x.includes('poliinsatur')))
  n.fibra = enGramos(componente(componentes, (x) => x.startsWith('fibra')))
  const sodioMg = componente(componentes, (x) => x === 'sodio' || x.startsWith('sodio'))
  if (sodioMg?.valor !== null && sodioMg?.valor !== undefined) {
    const gramos = sodioMg.unidad === 'mg' ? sodioMg.valor / 1000 : sodioMg.valor
    n.sal = gramos * 2.5
  }
  return n
}

export function porcionHabitual(nombre: string): number {
  const n = sinAcentos(nombre)
  if (/pechuga|filete|muslo|lomo|solomillo|carne|pollo|ternera|cerdo|pavo|cordero/.test(n)) return 150
  if (/pescad|merluz|bacala|salmon|atun|sardina|lubina|dorada|rape|lenguado|boqueron|trucha|caballa|bonito/.test(n)) return 150
  if (/platano/.test(n)) return 120
  if (/manzana|naranja|pera|melon|sandia|kiwi|mango|fruta/.test(n)) return 150
  return 100
}

/** Términos a probar en LIKE, del más específico al más corto. Los calificativos van al final. */
export function intentosBusqueda(consulta: string): string[] {
  const frase = terminoBedca(consulta)
  const tokens = tokensConsulta(consulta)
  const ordenados = [...tokens].sort((a, b) => {
    const ca = CUALIFICADOR.has(a) ? 1 : 0
    const cb = CUALIFICADOR.has(b) ? 1 : 0
    return ca - cb || b.length - a.length
  })
  const lista = [frase, ...ordenados.map((t) => t)].filter((t) => t.length >= 3)
  return [...new Set(lista)].slice(0, 4)
}

function listaXml(termino: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<foodquery>
  <type level="1"/>
  <selection>
    <atribute name="f_id"/>
    <atribute name="f_ori_name"/>
  </selection>
  <condition>
    <cond1><atribute1 name="f_ori_name"/></cond1>
    <relation type="LIKE"/>
    <cond3>${xmlTexto(termino)}</cond3>
  </condition>
</foodquery>`
}

function detalleXml(id: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<foodquery>
  <type level="2"/>
  <selection>
    <atribute name="f_id"/>
    <atribute name="f_ori_name"/>
    <atribute name="c_ori_name"/>
    <atribute name="best_location"/>
    <atribute name="v_unit"/>
  </selection>
  <condition>
    <cond1><atribute1 name="f_id"/></cond1>
    <relation type="EQUAL"/>
    <cond3>${id}</cond3>
  </condition>
</foodquery>`
}

async function postXml(xml: string, f: typeof fetch): Promise<string> {
  const res = await f(BEDCA_URL, {
    method: 'POST',
    headers: {
      'content-type': 'text/xml; charset=utf-8',
      accept: 'application/xml, text/xml',
      'user-agent': USER_AGENT,
      origin: 'https://www.bedca.net',
    },
    body: xml,
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) throw new Error(`BEDCA HTTP ${res.status}`)
  const largo = Number(res.headers.get('content-length') ?? 0)
  if (largo > 200_000) throw new Error('BEDCA respondió demasiado')
  const buf = await res.arrayBuffer()
  if (buf.byteLength > 200_000) throw new Error('BEDCA respondió demasiado')
  return new TextDecoder('utf-8').decode(buf)
}

export interface DetalleElegido {
  id: string
  nombre: string
  nutrientes: Nutrientes
  gramosPorcion: number
}

/**
 * Busca por nombre y descarga la ficha del mejor fresco.
 * Devuelve null si BEDCA no tiene un alimento que encaje o no responde.
 */
export async function buscarFrescoBedca(consulta: string, f: typeof fetch = fetch): Promise<DetalleElegido | null> {
  let filas: FilaBedca[] = []
  for (const termino of intentosBusqueda(consulta)) {
    let xml: string
    try {
      xml = await postXml(listaXml(termino), f)
    } catch (e) {
      console.warn('[bedca] lista no disponible:', e instanceof Error ? e.message : e)
      return null
    }
    filas = parsearListaBedca(xml)
    if (filas.length) break
  }
  const candidatos = elegirCandidatos(consulta, filas)
  for (const c of candidatos) {
    try {
      const xml = await postXml(detalleXml(c.id), f)
      const detalle = parsearDetalleBedca(xml)
      if (!detalle) continue
      return {
        id: detalle.id,
        nombre: detalle.nombre,
        nutrientes: nutrientesDesdeBedca(detalle.componentes),
        gramosPorcion: porcionHabitual(detalle.nombre),
      }
    } catch (e) {
      console.warn('[bedca] ficha no disponible:', e instanceof Error ? e.message : e)
    }
  }
  return null
}
