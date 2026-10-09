// Tests de limpieza/normalización de la salida de los modelos de visión.
// Ejecutar: npm test   (Node ≥ 22.18, TypeScript nativo)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ErrorParseo, extraerJson, FotoIlegible, MENSAJE_FOTO_ILEGIBLE, normalizarAnalisis, parsearRespuestaModelo } from '../functions/utils/iaParseo.ts'

const BASE = {
  nombre_plato: 'Ensalada de pollo',
  ingredientes: [
    { nombre: 'Pechuga de pollo', gramos: 120, calorias: 198, proteinas: 37.2, carbohidratos: 0, grasas: 4.3 },
    { nombre: 'Lechuga', gramos: 80, calorias: 12, proteinas: 1.1, carbohidratos: 2.3, grasas: 0.2 },
  ],
  calorias: 210,
  proteinas: 38.3,
  carbohidratos: 2.3,
  grasas: 4.5,
}

test('JSON limpio', () => {
  const r = parsearRespuestaModelo(JSON.stringify(BASE))
  assert.equal(r.nombre_plato, 'Ensalada de pollo')
  assert.equal(r.calorias, 210)
  assert.equal(r.ingredientes.length, 2)
})

test('con fences ```json … ```', () => {
  const r = parsearRespuestaModelo('```json\n' + JSON.stringify(BASE, null, 2) + '\n```')
  assert.equal(r.proteinas, 38.3)
})

test('con prosa alrededor y llaves dentro de cadenas', () => {
  const obj = { ...BASE, nombre_plato: 'Plato {especial} "casero"' }
  const r = parsearRespuestaModelo(`Claro, aquí tienes el análisis:\n${JSON.stringify(obj)}\nEspero que te sirva. {nota: no es JSON}`)
  assert.equal(r.nombre_plato, 'Plato {especial} "casero"')
})

test('números como texto con unidades y coma decimal, redondeo a 1 decimal', () => {
  const r = parsearRespuestaModelo(
    '{"nombre_plato":"Tostada","ingredientes":[{"nombre":"Pan","gramos":"60 g"}],"calorias":"160 kcal","proteinas":"5,56 g","carbohidratos":30.04,"grasas":"1.98"}',
  )
  assert.deepEqual([r.calorias, r.proteinas, r.carbohidratos, r.grasas], [160, 5.6, 30, 2])
  assert.equal(r.ingredientes[0]!.gramos, 60)
  assert.equal(r.ingredientes[0]!.calorias, undefined)
})

test('coma colgante reparada', () => {
  const r = parsearRespuestaModelo('{"nombre_plato":"Yogur","ingredientes":[],"calorias":100,"proteinas":10,"carbohidratos":8,"grasas":3,}')
  assert.equal(r.calorias, 100)
})

test('un promedio genérico del plato no tapa la suma de los ingredientes', () => {
  const r = normalizarAnalisis({ ...BASE, calorias: 80, proteinas: 5, carbohidratos: 10, grasas: 1 })
  assert.equal(r.calorias, 210)
  assert.equal(r.proteinas, 38.3)
  assert.equal(r.carbohidratos, 2.3)
  assert.equal(r.grasas, 4.5)
})

test('totales ausentes → suma de ingredientes', () => {
  const { calorias, proteinas, carbohidratos, grasas, ...sinTotales } = BASE
  void calorias, proteinas, carbohidratos, grasas
  const r = normalizarAnalisis(sinTotales)
  assert.equal(r.calorias, 210)
  assert.equal(r.proteinas, 38.3)
})

test('respuesta envuelta {"resultado": {...}}', () => {
  const r = normalizarAnalisis({ resultado: BASE })
  assert.equal(r.nombre_plato, 'Ensalada de pollo')
})

test('HTML en nombres se elimina', () => {
  const r = normalizarAnalisis({ ...BASE, nombre_plato: '<script>alert(1)</script>Paella' })
  assert.equal(r.nombre_plato.includes('<'), false)
})

test('objeto ya parseado (modo JSON de Workers AI)', () => {
  assert.equal(parsearRespuestaModelo(BASE).grasas, 4.5)
})

test('malformado → ErrorParseo', () => {
  assert.throws(() => parsearRespuestaModelo('{"nombre_plato": "Pizza", "calorias": 800'), ErrorParseo) // sin cerrar
  assert.throws(() => parsearRespuestaModelo('Lo siento, no puedo analizar esta imagen.'), ErrorParseo) // sin JSON
  assert.throws(() => parsearRespuestaModelo('{"nombre_plato": Pizza}'), ErrorParseo) // JSON inválido
  assert.throws(() => parsearRespuestaModelo(''), ErrorParseo)
})

test('valores negativos o absurdos → ErrorParseo', () => {
  assert.throws(() => normalizarAnalisis({ ...BASE, calorias: -50 }), ErrorParseo)
  assert.throws(() => normalizarAnalisis({ ...BASE, grasas: 99999 }), ErrorParseo)
})

test('extraerJson devuelve el PRIMER objeto', () => {
  assert.deepEqual(extraerJson('a {"x":1} b {"y":2}'), { x: 1 })
})

test('quita etiquetas markdown y el razonamiento <think>', () => {
  const json = JSON.stringify(BASE)
  const r = parsearRespuestaModelo(`<think>pollo a la plancha, arroz, salsa de soja, unos 350 g</think>\n\`\`\`json\n${json}\n\`\`\``)
  assert.equal(r.nombre_plato, 'Ensalada de pollo')
  assert.equal(r.calorias, 210)
})

// ---------------------------------------------------------------- texto (Workers AI)
import { CARRERA_VISION_MS, carreraVision, contenidoWorkersAI, cuentaFalloGateway, ErrorIA, ESQUEMA_FOTO, esperaReintentoMs, MODELOS_GROQ_VISION, PROMPT_SISTEMA, PROMPT_SISTEMA_TEXTO, REGLA_CLINICA, REGLA_NOMBRE_OFICIAL, REGLA_TITULO_PLATO, RESPONSE_SCHEMA, TIMEOUT_GATEWAY_FOTO_MS } from '../functions/utils/ia.ts'
import { normalizarProducto } from '../functions/utils/off.ts'

test('el prompt obliga al nombre oficial y el esquema pide input_query y display_name', () => {
  for (const prompt of [PROMPT_SISTEMA, PROMPT_SISTEMA_TEXTO]) {
    assert.ok(prompt.includes(REGLA_NOMBRE_OFICIAL))
    assert.ok(prompt.includes(REGLA_TITULO_PLATO))
    assert.match(prompt, /Hamburguesa completa de ternera/)
    assert.match(prompt, /pescado_marisco/)
    assert.match(prompt, /pechu plancha/)
    assert.match(prompt, /monstercita blanca/)
    assert.match(prompt, /pan bimbo inte/)
    assert.match(prompt, /input_query/)
    assert.match(prompt, /display_name/)
    assert.match(prompt, /crudo o cocinado/)
  }
  assert.match(PROMPT_SISTEMA, /Output ONLY valid JSON, with no Markdown and no code fences\./)
  assert.match(PROMPT_SISTEMA, /desglósalo obligatoriamente/)
  assert.match(PROMPT_SISTEMA, /Arroz blanco hervido/)
  assert.match(PROMPT_SISTEMA, /min_grams/)
  assert.match(PROMPT_SISTEMA, /No se distingue el alimento con claridad/)
  assert.match(PROMPT_SISTEMA, /cruasán casero/)
  assert.match(PROMPT_SISTEMA, /chorizo, panceta, morcilla/)
  assert.match(PROMPT_SISTEMA, /suma exacta/)
  assert.match(PROMPT_SISTEMA, /promedio genérico/)
  assert.match(PROMPT_SISTEMA, /aceite superficial/)
  assert.match(PROMPT_SISTEMA, /plato de lentejas/)
  assert.ok(PROMPT_SISTEMA.includes(REGLA_CLINICA))
  assert.match(PROMPT_SISTEMA_TEXTO, /chorizo, panceta, morcilla/)
  assert.match(PROMPT_SISTEMA_TEXTO, /suma exacta/)
  assert.ok(PROMPT_SISTEMA_TEXTO.includes(REGLA_CLINICA))
  assert.match(PROMPT_SISTEMA, /alternatives/)
  assert.doesNotMatch(PROMPT_SISTEMA, /```/)
  assert.equal(RESPONSE_SCHEMA.required.includes('input_query'), true)
  assert.equal(RESPONSE_SCHEMA.required.includes('display_name'), true)
  assert.equal(RESPONSE_SCHEMA.required.includes('alimento'), true)
  assert.equal(RESPONSE_SCHEMA.required.includes('categoria'), true)
  assert.equal(ESQUEMA_FOTO.properties.categoria.enum?.includes('lacteo'), true)
  assert.deepEqual(RESPONSE_SCHEMA.properties.ingredientes.items.required, ['input_query', 'display_name', 'gramos', 'calorias', 'proteinas', 'carbohidratos', 'grasas'])
  assert.equal(ESQUEMA_FOTO.required.includes('is_food'), true)
  assert.deepEqual(ESQUEMA_FOTO.properties.items.items.required, ['input_query', 'display_name', 'grams', 'min_grams', 'max_grams', 'calories', 'protein', 'carbs', 'fat'])
  assert.equal(TIMEOUT_GATEWAY_FOTO_MS, 5_000)
  assert.equal(CARRERA_VISION_MS, 2_000)
  assert.equal(ESQUEMA_FOTO.required.includes('alternatives'), false)
  assert.deepEqual(MODELOS_GROQ_VISION, ['llama-3.2-11b-vision-preview', 'llama-3.2-90b-vision-preview'])
})

test('un coloquialismo queda en input_query y el nombre oficial en display_name', () => {
  const r = parsearRespuestaModelo({
    input_query: 'pechu plancha',
    display_name: 'Pechuga de pollo a la plancha',
    nombre_plato: 'pechu plancha',
    ingredientes: [
      {
        input_query: 'pechu plancha',
        display_name: 'Pechuga de pollo a la plancha',
        nombre: 'pechu plancha',
        gramos: 150,
        calorias: 248,
        proteinas: 46,
        carbohidratos: 0,
        grasas: 6,
      },
    ],
    calorias: 248,
    proteinas: 46,
    carbohidratos: 0,
    grasas: 6,
  })
  assert.equal(r.input_query, 'pechu plancha')
  assert.equal(r.display_name, 'Pechuga de pollo a la plancha')
  assert.equal(r.nombre_plato, 'Pechuga de pollo a la plancha')
  assert.equal(r.ingredientes[0]?.nombre, 'Pechuga de pollo a la plancha')
  assert.equal(r.ingredientes[0]?.display_name, 'Pechuga de pollo a la plancha')
  assert.equal(r.ingredientes[0]?.input_query, 'pechu plancha')
})

test('el esquema corto de la foto se traduce al resultado de la app', () => {
  const r = parsearRespuestaModelo({
    is_food: true,
    items: [{ input_query: 'arroz basmati cocio', display_name: 'Arroz basmati cocido', grams: 150, min_grams: 120, max_grams: 180, calories: 195, protein: 4, carbs: 42, fat: 0.5 }],
    total: { calories: 195, protein: 4, carbs: 42, fat: 0.5 },
  })
  assert.equal(r.nombre_plato, 'Arroz basmati cocido')
  assert.equal(r.display_name, 'Arroz basmati cocido')
  assert.equal(r.ingredientes[0]?.input_query, 'arroz basmati cocio')
  assert.equal(r.ingredientes[0]?.gramos, 150)
  assert.equal(r.ingredientes[0]?.min_gramos, 120)
  assert.equal(r.ingredientes[0]?.max_gramos, 180)
  assert.equal(r.calorias, 195)
  assert.equal(r.carbohidratos, 42)
  assert.equal(r.grasas, 0.5)
})

test('un plato combinado queda en ingredientes separados, no en un solo alimento', () => {
  const r = parsearRespuestaModelo({
    is_food: true,
    items: [
      { input_query: 'arroz', display_name: 'Arroz blanco hervido', grams: 180, min_grams: 150, max_grams: 220, calories: 234, protein: 4.3, carbs: 52, fat: 0.5 },
      { input_query: 'pollo', display_name: 'Pechuga de pollo a la plancha', grams: 140, min_grams: 110, max_grams: 170, calories: 231, protein: 43, carbs: 0, fat: 5 },
      { input_query: 'aceite', display_name: 'Aceite de oliva virgen extra', grams: 8, min_grams: 5, max_grams: 12, calories: 72, protein: 0, carbs: 0, fat: 8 },
    ],
    total: { calories: 537, protein: 47.3, carbs: 52, fat: 13.5 },
  })
  assert.deepEqual(
    r.ingredientes.map((i) => i.nombre),
    ['Arroz blanco hervido', 'Pechuga de pollo a la plancha', 'Aceite de oliva virgen extra'],
  )
  assert.equal(r.ingredientes[2]?.gramos, 8)
  assert.equal(r.calorias, 537)
  assert.equal(r.nombre_plato, 'Arroz con pollo')
  assert.equal(r.nombre_plato.includes(','), false)
  assert.ok(r.nombre_plato.length <= 40)
  assert.equal(r.categoria, 'plato_elaborado')
  assert.match(r.descripcion ?? '', /Arroz blanco hervido/)
  assert.match(r.descripcion ?? '', /Aceite de oliva/)
})

test('una lista de ingredientes no se queda como título del plato', () => {
  const r = parsearRespuestaModelo({
    is_food: true,
    alimento: 'Pan de hamburguesa, Carne de res para hamburguesa',
    items: [
      { display_name: 'Pan de hamburguesa', grams: 60, calories: 160, protein: 5, carbs: 30, fat: 2 },
      { display_name: 'Carne de res', grams: 120, calories: 250, protein: 26, carbs: 0, fat: 16 },
    ],
    total: { calories: 410, protein: 31, carbs: 30, fat: 18 },
  })
  assert.equal(r.nombre_plato, 'Hamburguesa completa de ternera')
  assert.equal(r.display_name, 'Hamburguesa completa de ternera')
  assert.ok(r.nombre_plato.length <= 40)
  assert.equal(r.categoria, 'plato_elaborado')
  assert.match(r.descripcion ?? '', /Pan de hamburguesa/)
  assert.match(r.descripcion ?? '', /Carne de res/)
})

test('una categoria fuera del enum se corrige y una válida se conserva', () => {
  const yogur = parsearRespuestaModelo({
    nombre_plato: 'Yogur natural',
    categoria: 'lacteos',
    ingredientes: [{ nombre: 'Yogur natural', gramos: 125, calorias: 80, proteinas: 6, carbohidratos: 8, grasas: 2 }],
    calorias: 80,
    proteinas: 6,
    carbohidratos: 8,
    grasas: 2,
  })
  assert.equal(yogur.categoria, 'lacteo')
  const marcada = parsearRespuestaModelo({
    nombre_plato: 'Manzana',
    categoria: 'snack',
    ingredientes: [{ nombre: 'Manzana', gramos: 150, calorias: 80, proteinas: 0, carbohidratos: 20, grasas: 0 }],
    calorias: 80,
    proteinas: 0,
    carbohidratos: 20,
    grasas: 0,
  })
  assert.equal(marcada.categoria, 'snack')
  assert.equal(marcada.nombre_plato, 'Manzana')
})

test('una foto ilegible no inventa comida y conserva el mensaje fijo', () => {
  const crudo = '{"is_food": false, "error_message": "No se distingue el alimento con claridad. Intenta enfocar más cerca o con mejor luz."}'
  assert.throws(() => parsearRespuestaModelo(crudo), FotoIlegible)
  assert.throws(
    () => parsearRespuestaModelo({ is_food: false, error_message: 'otra cosa', items: [{ display_name: 'Pizza', grams: 300, calories: 800, protein: 30, carbs: 80, fat: 30 }] }),
    (e: unknown) => e instanceof FotoIlegible && e.message === MENSAJE_FOTO_ILEGIBLE,
  )
})

test('una foto sin alternatives sigue siendo válida y no inventa alternativas', () => {
  const r = parsearRespuestaModelo({
    is_food: true,
    items: [{ display_name: 'Arroz blanco hervido', grams: 150, calories: 195, protein: 4, carbs: 42, fat: 0.5 }],
    total: { calories: 195, protein: 4, carbs: 42, fat: 0.5 },
  })
  assert.equal(r.nombre_plato, 'Arroz blanco hervido')
  assert.equal('alternativas' in r, false)
})

test('la foto conserva como máximo dos alternativas completas', () => {
  const r = parsearRespuestaModelo({
    is_food: true,
    items: [{ display_name: 'Cruasán', grams: 70, calories: 280, protein: 5, carbs: 32, fat: 15 }],
    total: { calories: 280, protein: 5, carbs: 32, fat: 15 },
    alternatives: [
      { display_name: 'Cruasán de mantequilla', grams: 60, calories: 240, protein: 4, carbs: 26, fat: 14 },
      { display_name: 'Brioche', grams: 80, calories: 260, protein: 6, carbs: 34, fat: 11 },
      { display_name: 'Napolitana', grams: 90, calories: 320, protein: 6, carbs: 36, fat: 16 },
      { display_name: 'Incompleta' },
    ],
  })
  assert.deepEqual(
    r.alternativas?.map((a) => a.nombre),
    ['Cruasán de mantequilla', 'Brioche'],
  )
  assert.equal(r.alternativas?.[0]?.gramos, 60)
  assert.equal(r.alternativas?.[1]?.grasas, 11)
})

test('carreraVision: el principal rápido gana y no llama al secundario', async () => {
  let secundario = 0
  const r = await carreraVision(
    () => Promise.resolve('principal'),
    () => {
      secundario += 1
      return Promise.resolve('secundario')
    },
    80,
  )
  assert.equal(r, 'principal')
  await new Promise((res) => setTimeout(res, 120))
  assert.equal(secundario, 0)
})

test('carreraVision: si el principal no responde, el secundario arranca y gana', async () => {
  let secundario = 0
  const r = await carreraVision(
    () => new Promise<string>(() => {}),
    () => {
      secundario += 1
      return Promise.resolve('secundario')
    },
    40,
  )
  assert.equal(r, 'secundario')
  assert.equal(secundario, 1)
})

test('carreraVision: un fallo rápido no definitivo arranca el secundario al momento', async () => {
  const t0 = Date.now()
  const r = await carreraVision(() => Promise.reject(new Error('gateway')), () => Promise.resolve('secundario'), 5_000)
  assert.equal(r, 'secundario')
  assert.ok(Date.now() - t0 < 500)
})

test('el contrato clínico se traduce al plato y la suma manda', () => {
  const r = parsearRespuestaModelo({
    dish_name: 'Lentejas estofadas con chorizo',
    detected_ingredients: [
      { name: 'Lentejas cocidas', weight_est_g: 200, source: 'base', calories_kcal: 230, protein_g: 18, carbs_g: 40, fats_g: 1 },
      { name: 'Chorizo guisado', weight_est_g: 40, source: 'detected_inclusion', calories_kcal: 180, protein_g: 8, carbs_g: 1, fats_g: 16 },
    ],
    macros: { calories_kcal: 410, protein_g: 26, carbs_g: 41, fats_g: 17, fiber_g: 8 },
    confidence_score: 0.8,
    dietary_flags: ['contains_pork'],
  })
  assert.deepEqual(
    r.ingredientes.map((i) => i.nombre),
    ['Lentejas cocidas', 'Chorizo guisado'],
  )
  assert.equal(r.ingredientes[1]?.gramos, 40)
  assert.equal(r.calorias, 410)
  assert.equal(r.grasas, 17)
  assert.ok(r.nombre_plato.length <= 40)
  assert.equal(r.nombre_plato.toLowerCase().includes('plato de lentejas'), false)
})

test('unas calorías imposibles se rehacen con Atwater', () => {
  const r = normalizarAnalisis({
    nombre_plato: 'Costilla con patata',
    ingredientes: [{ nombre: 'Costilla de cerdo', gramos: 150, calorias: 10, proteinas: 20, carbohidratos: 20, grasas: 20 }],
    calorias: 10,
    proteinas: 20,
    carbohidratos: 20,
    grasas: 20,
  })
  assert.equal(r.calorias, 340)
})

test('el reintento de cuota es 500 ms y 1000 ms más el jitter', () => {
  assert.equal(esperaReintentoMs(0, 0), 500)
  assert.equal(esperaReintentoMs(1, 0), 1000)
  assert.equal(esperaReintentoMs(1, 0.5), 1125)
})

test('carreraVision: una foto ilegible no llama al secundario', async () => {
  let secundario = 0
  await assert.rejects(
    () =>
      carreraVision(
        () => Promise.reject(new FotoIlegible()),
        () => {
          secundario += 1
          return Promise.resolve('no')
        },
        30,
      ),
    FotoIlegible,
  )
  await new Promise((res) => setTimeout(res, 60))
  assert.equal(secundario, 0)
})

test('una foto antigua, solo con name, sigue siendo un resultado válido', () => {
  const r = parsearRespuestaModelo({
    items: [{ name: 'Rice', grams: 150, calories: 195, protein: 4, carbs: 42, fat: 0.5 }],
    total: { calories: 195, protein: 4, carbs: 42, fat: 0.5 },
  })
  assert.equal(r.nombre_plato, 'Rice')
  assert.equal(r.display_name, 'Rice')
})

test('el circuito no cuenta un JSON inválido, una clave ausente ni un rechazo definitivo', () => {
  assert.equal(cuentaFalloGateway(new ErrorParseo('json')), false)
  assert.equal(cuentaFalloGateway(new ErrorIA('GROQ_API_KEY no configurada')), false)
  assert.equal(cuentaFalloGateway(new ErrorIA('Binding AI no disponible')), false)
  const definitivo = new ErrorIA('no es comida')
  definitivo.definitivo = true
  assert.equal(cuentaFalloGateway(definitivo), false)
  assert.equal(cuentaFalloGateway(new ErrorIA('Gemini HTTP 503')), true)
  assert.equal(cuentaFalloGateway(new ErrorIA('Workers AI: timeout 5000 ms')), true)
})

test('contenidoWorkersAI: formato OpenAI (choices) y clásico (response)', () => {
  const json = '{"nombre_plato":"Tostada","ingredientes":[],"calorias":200,"proteinas":5,"carbohidratos":30,"grasas":6}'
  assert.equal(parsearRespuestaModelo(contenidoWorkersAI({ choices: [{ message: { content: json } }] })).calorias, 200)
  assert.equal(parsearRespuestaModelo(contenidoWorkersAI({ response: JSON.parse(json) })).nombre_plato, 'Tostada')
  assert.equal(parsearRespuestaModelo(contenidoWorkersAI({ response: '```json\n' + json + '\n```' })).grasas, 6)
})

test('Open Food Facts: normaliza por 100 g, kJ→kcal y descarta basura', () => {
  const p = normalizarProducto({ code: '8480000610553', product_name: 'Gazpacho <b>', brands: 'Hacendado,Otra', nutriments: { 'energy-kcal_100g': 52, proteins_100g: '1,2', carbohydrates_100g: 11, fat_100g: 0 } })
  assert.deepEqual(p, {
    codigo: '8480000610553',
    nombre: 'Gazpacho b',
    marca: 'Hacendado',
    traducido: false,
    por100: { calorias: 52, proteinas: 1.2, carbohidratos: 11, grasas: 0 },
    extra: { azucares: null, saturadas: null, fibra: null, sal: null },
    racion: null,
    envase: null,
    unidad: 'g',
    fuente: 'off',
  })
  assert.equal(normalizarProducto({ product_name: 'X', nutriments: { 'energy-kj_100g': 418.4 } })?.por100.calorias, 100)
  assert.equal(normalizarProducto({ product_name: '', nutriments: { 'energy-kcal_100g': 10 } }), null)
  assert.equal(normalizarProducto({ product_name: 'Sin datos', nutriments: {} }), null)
})
