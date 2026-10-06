// Cadena multiproveedor de IA: fetch simulado para cada proveedor, orden de
// fallback, reintentos, circuit breaker, timeouts y logs sin datos del usuario.
// Ejecutar: npm test
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import type { Env } from '../functions/utils/env.ts'
import { ejecutarCadena, ErrorIA, ordenProveedores, reiniciarCircuitos, type AlmacenCircuito, type EstadoCircuito, type IdProveedor, type PeticionIA } from '../functions/utils/iaCadena.ts'
import { PROVEEDORES } from '../functions/utils/iaProveedores.ts'
import { analizarImagen, analizarTexto, ejecutarIA, leerEtiqueta, parsearPlato } from '../functions/utils/ia.ts'

const PLATO = {
  nombre_plato: 'Pollo con arroz',
  ingredientes: [
    { nombre: 'Pechuga de pollo', gramos: 150, calorias: 248, proteinas: 46.5, carbohidratos: 0, grasas: 5.4 },
    { nombre: 'Arroz blanco cocido', gramos: 200, calorias: 260, proteinas: 5.4, carbohidratos: 56, grasas: 0.6 },
  ],
  calorias: 508,
  proteinas: 51.9,
  carbohidratos: 56,
  grasas: 6,
}
const JPEG = { bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]), mime: 'image/jpeg' as const }
const DESCRIPCION = 'secreto-del-usuario: pollo con arroz'

type Llamada = { url: string; init: RequestInit; body: any }
let llamadas: Llamada[] = []
let respuestas: ((l: Llamada) => Response | Promise<Response>)[] = []
const fetchOriginal = globalThis.fetch
let logs: string[] = []
const consolaOriginal = { log: console.log, warn: console.warn, error: console.error }

beforeEach(() => {
  llamadas = []
  respuestas = []
  logs = []
  reiniciarCircuitos()
  globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const l: Llamada = { url: String(input), init, body: init.body ? JSON.parse(String(init.body)) : null }
    llamadas.push(l)
    const r = respuestas.shift()
    if (!r) throw new Error('fetch inesperado: ' + l.url)
    return r(l)
  }) as typeof fetch
  for (const k of ['log', 'warn', 'error'] as const) console[k] = (...a: unknown[]) => void logs.push(a.map(String).join(' '))
})
afterEach(() => {
  globalThis.fetch = fetchOriginal
  Object.assign(console, consolaOriginal)
})

const jsonRes = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...headers } })
const gemOk = (obj: unknown = PLATO) => () => jsonRes({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] })
const oaiOk = (contenido: string) => () => jsonRes({ choices: [{ message: { content: contenido } }] })
const status = (s: number, headers: Record<string, string> = {}) => () => jsonRes({ error: { message: 'x' } }, s, headers)

const sinEspera = { dormir: async () => {} }
const env = (extra: Partial<Env> = {}) => ({ GEMINI_API_KEY: 'g-key', GROQ_API_KEY: 'q-key', ...extra }) as unknown as Env

/** Binding AI falso: responde según el modelo. */
function aiFalso(porModelo: Record<string, (body: any) => unknown>) {
  const usadas: { modelo: string; body: any }[] = []
  return {
    usadas,
    run: async (modelo: string, body: any) => {
      usadas.push({ modelo, body })
      const f = porModelo[modelo]
      if (!f) throw new Error('5007: No such model ' + modelo)
      return f(body)
    },
  }
}

test('IA_PROVEEDORES: alias, orden, duplicados y desconocidos', () => {
  assert.deepEqual(ordenProveedores('groq, workersai,gemini,groq,foo'), ['groq', 'workers-ai', 'gemini'])
  assert.deepEqual(ordenProveedores(''), ['gemini', 'groq', 'trujillo', 'workers-ai'])
  assert.deepEqual(ordenProveedores('nada'), ['gemini', 'groq', 'trujillo', 'workers-ai'])
})

test('Gemini: foto con inline_data, thinking bajo y responseSchema → proveedor gemini', async () => {
  respuestas.push(gemOk())
  const r = await analizarImagen(env(), JPEG)
  assert.equal(r.proveedor, 'gemini')
  assert.equal(r.modelo, 'gemini-3.8-flash')
  assert.equal(r.resultado.calorias, 508)
  const l = llamadas[0]!
  assert.match(l.url, /models\/gemini-3\.8-flash:generateContent$/)
  assert.equal((l.init.headers as Record<string, string>)['x-goog-api-key'], 'g-key')
  assert.equal(l.body.contents[0].parts[0].inline_data.mime_type, 'image/jpeg')
  assert.equal(l.body.generationConfig.thinkingConfig.thinkingLevel, 'low')
  assert.ok(l.body.generationConfig.responseSchema)
})

test('Gemini: 503 → 1 reintento → modelo de respaldo dentro del proveedor', async () => {
  let esperas = 0
  respuestas.push(status(503), status(503), gemOk())
  const r = await ejecutarIA(env(), { tarea: 'plato', sistema: 's', usuario: 'u', imagen: JPEG }, parsearPlato, { dormir: async () => void esperas++ })
  assert.equal(r.proveedor, 'gemini')
  assert.equal(r.modelo, 'gemini-3.5-flash-lite')
  assert.equal(llamadas.length, 3)
  assert.equal(esperas, 1)
  assert.deepEqual(
    r.intentos.map((i) => i.resultado),
    ['http_503', 'http_503', 'ok'],
  )
})

test('Gemini: 400 por thinkingLevel → se repite sin thinkingConfig', async () => {
  respuestas.push(() => new Response('{"error":{"message":"thinking_level is not supported"}}', { status: 400 }), gemOk())
  const r = await analizarImagen(env(), JPEG)
  assert.equal(r.proveedor, 'gemini')
  assert.equal(llamadas[1]!.body.generationConfig.thinkingConfig, undefined)
})

test('Groq: sin clave de Gemini → visión con qwen, data URL, modo JSON y sin razonamiento', async () => {
  respuestas.push(oaiOk('```json\n' + JSON.stringify(PLATO) + '\n```\nEspero que sirva'))
  const r = await analizarImagen(env({ GEMINI_API_KEY: undefined }), JPEG)
  assert.equal(r.proveedor, 'groq')
  assert.equal(r.modelo, 'qwen/qwen3.8-27b')
  const l = llamadas[0]!
  assert.equal(l.url, 'https://api.groq.com/openai/v1/chat/completions')
  assert.equal((l.init.headers as Record<string, string>).authorization, 'Bearer q-key')
  assert.deepEqual(l.body.response_format, { type: 'json_object' })
  assert.equal(l.body.reasoning_effort, 'none')
  assert.match(l.body.messages[1].content[1].image_url.url, /^data:image\/jpeg;base64,/)
})

test('Groq texto: gpt-oss-20b con reasoning_effort low; 429 largo → sin reintento → 120b', async () => {
  respuestas.push(status(429, { 'retry-after': '30' }), oaiOk(JSON.stringify(PLATO)))
  const r = await ejecutarIA(env({ IA_PROVEEDORES: 'groq' }), { tarea: 'texto', sistema: 's', usuario: 'u' }, parsearPlato, sinEspera)
  assert.equal(r.modelo, 'openai/gpt-oss-120b')
  assert.equal(llamadas[0]!.body.model, 'openai/gpt-oss-20b')
  assert.equal(llamadas[0]!.body.reasoning_effort, 'low')
  assert.equal(llamadas[0]!.body.include_reasoning, false)
  assert.equal(llamadas.length, 2)
})

test('Groq: 400 json_validate_failed → se rescata failed_generation', async () => {
  respuestas.push(() => jsonRes({ error: { code: 'json_validate_failed', failed_generation: 'Aquí está: ' + JSON.stringify(PLATO) + ' fin' } }, 400))
  const r = await analizarTexto(env({ IA_PROVEEDORES: 'groq' }), 'pollo con arroz')
  assert.equal(r.proveedor, 'groq')
  assert.equal(r.resultado.nombre_plato, 'Pollo con arroz')
})

test('Trujillo AI: desactivado por defecto; con flag + token llama al endpoint con Bearer', async () => {
  const e1 = env({ IA_PROVEEDORES: 'trujillo,groq' })
  respuestas.push(oaiOk(JSON.stringify(PLATO)))
  const r1 = await analizarImagen(e1, JPEG)
  assert.equal(r1.proveedor, 'groq')
  assert.equal(llamadas.length, 1)

  respuestas.push(oaiOk(JSON.stringify(PLATO)))
  const r2 = await analizarImagen(env({ IA_PROVEEDORES: 'trujillo', IA_TRUJILLO: '1', TRUJILLO_AI_TOKEN: 't-tok' }), JPEG)
  assert.equal(r2.proveedor, 'trujillo')
  assert.equal(r2.modelo, 'auto-vision')
  const l = llamadas[1]!
  assert.equal(l.url, 'https://ai.trujillomingorance.com/api/v1/chat/completions')
  assert.equal((l.init.headers as Record<string, string>).authorization, 'Bearer t-tok')
  assert.equal(l.body.stream, false)
})

test('Trujillo AI: usa el Service Binding si existe (no Internet)', async () => {
  const usadas: string[] = []
  const binding = { fetch: async (url: string) => (usadas.push(url), new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(PLATO) } }] }))) }
  const r = await analizarTexto(env({ IA_PROVEEDORES: 'trujillo', IA_TRUJILLO: 'true', TRUJILLO_AI_TOKEN: 't', TRUJILLO_AI: binding as unknown as Fetcher }), 'x')
  assert.equal(r.proveedor, 'trujillo')
  assert.equal(usadas.length, 1)
  assert.equal(llamadas.length, 0)
})

test('Workers AI: licencia exigida → siguiente modelo; qwen sin razonamiento', async () => {
  const ai = aiFalso({
    '@cf/qwen/qwen3.8-27b': () => {
      throw new Error('5016: Prior to using this model, you must submit the prompt "agree"')
    },
    '@cf/google/gemma-4-26b-a4b-it': () => ({ choices: [{ message: { content: JSON.stringify(PLATO) } }] }),
  })
  const r = await analizarImagen(env({ GEMINI_API_KEY: undefined, GROQ_API_KEY: undefined, AI: ai as unknown as Ai }), JPEG)
  assert.equal(r.proveedor, 'workers-ai')
  assert.equal(r.modelo, '@cf/google/gemma-4-26b-a4b-it')
  assert.deepEqual(ai.usadas[0]!.body.chat_template_kwargs, { enable_thinking: false })
  assert.equal(ai.usadas.length, 2) // la licencia no se reintenta
})

test('Workers AI: llava (formato clásico) y respuesta en `description`', async () => {
  const ai = aiFalso({ '@cf/llava-hf/llava-1.5-7b-hf': (b) => (assert.ok(Array.isArray(b.image)), { description: JSON.stringify(PLATO) }) })
  const r = await analizarImagen(env({ IA_PROVEEDORES: 'workersai', WORKERS_AI_MODELOS_VISION: '@cf/llava-hf/llava-1.5-7b-hf', AI: ai as unknown as Ai }), JPEG)
  assert.equal(r.modelo, '@cf/llava-hf/llava-1.5-7b-hf')
})

test('orden de fallback completo: groq 5xx → gemini 429 → JSON roto → workers-ai', async () => {
  const ai = aiFalso({ '@cf/qwen/qwen3.8-27b': () => ({ response: JSON.stringify(PLATO) }) })
  respuestas.push(status(500), status(502)) // groq qwen (con reintento)
  respuestas.push(status(429, { 'retry-after': '60' })) // gemini flash (sin reintento: espera larga)
  respuestas.push(() => jsonRes({ candidates: [{ content: { parts: [{ text: 'no es json' }] } }] })) // gemini lite: parseo
  const p: PeticionIA = { tarea: 'plato', sistema: 's', usuario: 'u', imagen: JPEG }
  const r = await ejecutarIA(env({ IA_PROVEEDORES: 'groq,gemini,trujillo,workersai', AI: ai as unknown as Ai }), p, parsearPlato, sinEspera)
  assert.equal(r.proveedor, 'workers-ai')
  assert.deepEqual(
    r.intentos.map((i) => `${i.proveedor}:${i.resultado}`),
    ['groq:http_500', 'groq:http_502', 'gemini:http_429', 'gemini:parseo', 'trujillo:desactivado', 'workers-ai:ok'],
  )
})

test('respuesta incoherente (kcal absurdas) → se prueba el siguiente proveedor', async () => {
  respuestas.push(gemOk({ ...PLATO, ingredientes: [], calorias: 3000 }), gemOk({ ...PLATO, ingredientes: [], calorias: 3000 }))
  respuestas.push(oaiOk(JSON.stringify(PLATO)))
  const r = await analizarImagen(env(), JPEG)
  assert.equal(r.proveedor, 'groq')
})

test('error definitivo (no es una tabla) corta la cadena', async () => {
  class NoEsTabla extends Error {
    definitivo = true
  }
  respuestas.push(gemOk({ es_tabla: false }))
  await assert.rejects(
    leerEtiqueta(env(), JPEG, (o: any) => {
      if (o.es_tabla === false) throw new NoEsTabla('no es tabla')
      return o
    }),
    (e: unknown) => e instanceof ErrorIA && e.definitivo,
  )
  assert.equal(llamadas.length, 1)
})

test('todos fallan → ErrorIA con intentos; los logs no contienen datos del usuario', async () => {
  const ai = aiFalso({})
  for (let i = 0; i < 6; i++) respuestas.push(status(500))
  await assert.rejects(analizarTexto(env({ AI: ai as unknown as Ai }), DESCRIPCION), (e: unknown) => e instanceof ErrorIA && !e.definitivo && e.intentos.length > 0)
  const todo = logs.join('\n')
  assert.match(todo, /fallo_total/)
  assert.ok(!todo.includes('secreto-del-usuario'))
})

test('timeout por llamada: un proveedor colgado no bloquea la cadena', async () => {
  respuestas.push(
    (l) =>
      new Promise<Response>((_, rej) => {
        l.init.signal?.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })))
      }),
  )
  respuestas.push(oaiOk(JSON.stringify(PLATO)))
  const r = await ejecutarIA(env({ GEMINI_MODEL_RESPALDO: 'gemini-3.8-flash' }), { tarea: 'texto', sistema: 's', usuario: 'u' }, parsearPlato, {
    ...sinEspera,
    config: { timeoutMs: 30 },
  })
  assert.equal(r.proveedor, 'groq')
  assert.equal(r.intentos[0]!.resultado, 'timeout')
})

test('circuit breaker: 3 fallos seguidos → se salta; si todos están abiertos se prueban igual', async () => {
  const estado = new Map<IdProveedor, EstadoCircuito>()
  const almacen: AlmacenCircuito = { leer: async (id) => estado.get(id) ?? null, escribir: async (id, e) => void (e ? estado.set(id, e) : estado.delete(id)) }
  let t = 1_000_000
  const o = { ...sinEspera, almacen, ahora: () => t, config: { circuitoFallos: 3, circuitoMs: 60_000 } }
  const e = env({ IA_PROVEEDORES: 'gemini,groq' })
  const p: PeticionIA = { tarea: 'texto', sistema: 's', usuario: 'u' }
  for (let i = 0; i < 3; i++) {
    respuestas.push(status(500), status(500), status(500), status(500), oaiOk(JSON.stringify(PLATO)))
    assert.equal((await ejecutarCadena(e, p, parsearPlato, { ...o, proveedores: PROVEEDORES })).proveedor, 'groq')
  }
  assert.ok(estado.get('gemini')!.abiertoHasta > t)
  // Circuito abierto: Gemini ni se llama.
  respuestas.push(oaiOk(JSON.stringify(PLATO)))
  const r = await ejecutarCadena(e, p, parsearPlato, { ...o, proveedores: PROVEEDORES })
  assert.equal(r.intentos[0]!.resultado, 'circuito_abierto')
  assert.equal(llamadas.at(-1)!.url, 'https://api.groq.com/openai/v1/chat/completions')
  // Solo Gemini en la cadena y abierto → se prueba igualmente (half-open) y, si responde, se cierra.
  respuestas.push(gemOk())
  const r2 = await ejecutarCadena(env({ IA_PROVEEDORES: 'gemini' }), p, parsearPlato, { ...o, proveedores: PROVEEDORES })
  assert.equal(r2.proveedor, 'gemini')
  assert.equal(estado.get('gemini'), undefined)
  // Pasado el tiempo, vuelve a probarse normalmente.
  t += 61_000
  assert.equal(estado.size, 0)
})

test('sin claves ni binding → ErrorIA (503 amable en el handler)', async () => {
  await assert.rejects(analizarImagen({} as Env, JPEG), (e: unknown) => e instanceof ErrorIA)
  assert.equal(llamadas.length, 0)
})
