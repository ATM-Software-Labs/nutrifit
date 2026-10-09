import { test } from 'node:test'
import assert from 'node:assert/strict'
import { consultaEuropa, normalizarProducto, parsearCantidad, pedirJson, priorizarCoincidencias, terminoOFF, urlOffMundo } from '../functions/utils/off.ts'

test('OFF: cantidades del envase', () => {
  assert.deepEqual(parsearCantidad('2.25 l'), { cantidad: 2250, unidad: 'ml', unidades: null })
  assert.deepEqual(parsearCantidad('6 x 125 g'), { cantidad: 125, unidad: 'g', unidades: 6 })
  assert.deepEqual(parsearCantidad('33 cl'), { cantidad: 330, unidad: 'ml', unidades: null })
  assert.deepEqual(parsearCantidad('Barquitas mexicanas integrales 8 unidades envase 193 g'), { cantidad: 193, unidad: 'g', unidades: 8 })
  assert.equal(parsearCantidad('sin cantidad'), null)
})

test('OFF: producto completo (azúcares, saturadas, fibra, sal, ración por unidades)', () => {
  const p = normalizarProducto({
    code: '8410076472854',
    product_name: 'Barquitas mexicanas integrales 8 unidades envase 193 g',
    brands: 'Old El Paso',
    quantity: '',
    nutriments: { 'energy-kcal_100g': 302, proteins_100g: 9.3, carbohidratos_100g: 0, carbohydrates_100g: 47.9, fat_100g: 7, 'saturated-fat_100g': 1, sugars_100g: 2, fiber_100g: 5.3, salt_100g: 1 },
  })!
  assert.equal(p.marca, 'Old El Paso')
  assert.deepEqual(p.extra, { azucares: 2, saturadas: 1, fibra: 5.3, sal: 1 })
  assert.equal(p.envase, 193)
  assert.equal(p.racion, 24.1)
  assert.equal(p.unidad, 'g')
})

test('OFF: bebida en ml, sodio→sal y marcas como array (search-a-licious)', () => {
  const p = normalizarProducto({ code: '5449000214799', product_name_es: 'Coca-Cola zero', brands: ['Coca Cola'], quantity: '2,25 l', nutriments: { 'energy-kcal_100g': 0.3, sodium_100g: 0.008 } })!
  assert.equal(p.unidad, 'ml')
  assert.equal(p.envase, 2250)
  assert.equal(p.marca, 'Coca Cola')
  assert.equal(p.extra.sal, 0.02)
  assert.equal(p.por100.calorias, 0.3)
})

test('OFF: término sin sintaxis de búsqueda', () => {
  assert.equal(terminoOFF('  Coca-Cola  "Zero" countries_tags:(x) '), 'coca-cola zero countries_tags x')
})

test('OFF: reintenta en 5xx y devuelve null en 404', async () => {
  let n = 0
  const f = (async () => {
    n++
    return n === 1 ? new Response('x', { status: 502 }) : Response.json({ ok: 1 })
  }) as unknown as typeof fetch
  assert.deepEqual(await pedirJson('https://x', 2, 1000, f), { ok: 1 })
  assert.equal(n, 2)
  const f404 = (async () => new Response('', { status: 404 })) as unknown as typeof fetch
  assert.equal(await pedirJson('https://x', 2, 1000, f404), null)
  const f400 = (async () => {
    n++
    return new Response('', { status: 400 })
  }) as unknown as typeof fetch
  n = 0
  await assert.rejects(pedirJson('https://x', 3, 1000, f400))
  assert.equal(n, 1) // 4xx no se reintenta
})

test('OFF: prioriza productos que contienen todas las palabras', () => {
  const mk = (nombre: string, marca: string) => normalizarProducto({ product_name: nombre, brands: marca, nutriments: { 'energy-kcal_100g': 1 } })!
  const r = priorizarCoincidencias([mk('Coca-Cola', 'Coca-Cola'), mk('Coca-Cola zero', 'Coca Cola'), mk('Zero Azúcar', 'Coca-Cola')], 'coca cola zero')
  assert.equal(r[0]!.nombre, 'Coca-Cola zero')
})

test('OFF: España y la UE van antes que una ficha sin traducir', () => {
  const local = normalizarProducto({ product_name_es: 'Yogur natural', brands: 'Hacendado', nutriments: { 'energy-kcal_100g': 60 } })!
  const extranjero = normalizarProducto({ product_name: 'Yogur natural', brands: 'Foreign Dairy', nutriments: { 'energy-kcal_100g': 60 } })!
  const r = priorizarCoincidencias([extranjero, local], 'yogur natural')
  assert.equal(r[0]!.marca, 'Hacendado')
  assert.equal(local.traducido, true)
  assert.equal(extranjero.traducido, false)
  const v2 = urlOffMundo('v2', 'yogur', 'code,product_name', 24)
  assert.match(v2, /^https:\/\/world\.openfoodfacts\.org\/api\/v2\/search\?/)
  assert.match(v2, /countries_tags_en=spain,european-union/)
  assert.match(v2, /lc=es/)
  assert.match(consultaEuropa('yogur'), /en:spain/)
  assert.match(consultaEuropa('yogur'), /en:european-union/)
  assert.match(urlOffMundo('cgi', 'pepsi', 'code', 20), /lc=es/)
})
