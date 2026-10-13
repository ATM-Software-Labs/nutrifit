import { test } from 'node:test'
import assert from 'node:assert/strict'
import { aMl, cuentaComoAgua, desdeMl, esLiquido, formatoCantidad, opcionesRapidas, parsearMedida } from '../src/lib/liquidos.ts'

test('parsearMedida: ml, cl, l, fl oz, packs y decimales con coma', () => {
  assert.deepEqual(parsearMedida('275 ml'), { cantidad: 275, unidad: 'ml', unidades: null })
  assert.equal(parsearMedida('33 cl')!.cantidad, 330)
  assert.equal(parsearMedida('1,5 l')!.cantidad, 1500)
  assert.equal(parsearMedida('1.5L')!.cantidad, 1500)
  assert.equal(parsearMedida('2 litros')!.cantidad, 2000)
  assert.equal(Math.round(parsearMedida('12 fl oz')!.cantidad), 355)
  assert.equal(Math.round(parsearMedida('12 fl. oz.')!.cantidad), 355)
  assert.deepEqual(parsearMedida('6 x 33 cl'), { cantidad: 330, unidad: 'ml', unidades: 6 })
  assert.deepEqual(parsearMedida('400 g'), { cantidad: 400, unidad: 'g', unidades: null })
  assert.equal(parsearMedida('1 kg')!.cantidad, 1000)
  assert.equal(parsearMedida('sin medida'), null)
  assert.equal(parsearMedida('Lata 33cl, 4 latas')!.cantidad, 330)
})

test('esLiquido por unidad, por 100 ml, cantidad, categorías y nombre', () => {
  assert.ok(esLiquido({ unidadDeclarada: 'ml' }))
  assert.ok(!esLiquido({ unidadDeclarada: 'g', categorias: ['en:beverages'] }))
  assert.ok(esLiquido({ porNutricion: '100ml' }))
  assert.ok(esLiquido({ cantidad: '275 ml', porNutricion: '100g' }))
  assert.ok(esLiquido({ categorias: ['en:plant-based-foods', 'en:waters'] }))
  assert.ok(esLiquido({ categorias: ['en:dairies', 'en:dairy-drinks'] }))
  assert.ok(!esLiquido({ categorias: ['en:beverages', 'en:cocoa-powders'] }))
  assert.ok(esLiquido({ nombre: 'Agua mineral natural' }))
  assert.ok(esLiquido({ unidadRacion: 'MLT' }))
  assert.ok(!esLiquido({ nombre: 'Nutella', cantidad: '400 g' }))
  assert.ok(!esLiquido({ nombre: 'Arroz con leche' }))
  assert.ok(!esLiquido({ nombre: 'Queso batido 0 %' }))
  assert.ok(esLiquido({ nombre: 'Leche semidesnatada' }))
})

test('conversiones y formato', () => {
  assert.equal(aMl(33, 'cl'), 330)
  assert.equal(aMl(1.5, 'l'), 1500)
  assert.equal(desdeMl(1500, 'l'), 1.5)
  assert.equal(formatoCantidad(1500, 'ml'), '1,5 l')
  assert.equal(formatoCantidad(275, 'ml'), '275 ml')
})

test('opciones rápidas para líquido y sólido', () => {
  const l = opcionesRapidas({ unidad: 'ml', envase: 275, racion: null })
  assert.deepEqual(l.map((o) => o.clave), ['envase', 'medio', 'vaso'])
  assert.equal(l[0]!.etiqueta, 'Envase entero (275 ml)')
  const c = opcionesRapidas({ unidad: 'ml', envase: 1500, racion: 250 })
  assert.deepEqual(c.map((o) => o.clave), ['envase', 'medio', 'porcion'])
  const s = opcionesRapidas({ unidad: 'g', envase: 400, racion: 15 })
  assert.deepEqual(s.map((o) => o.etiqueta), ['Paquete entero (400 g)', '½ paquete (200 g)', 'Una unidad/porción (15 g)'])
})

test('½ envase también si la porción es el envase entero', () => {
  assert.deepEqual(opcionesRapidas({ unidad: 'ml', envase: 275, racion: 275 }).map((o) => o.clave), ['envase', 'medio', 'vaso'])
})

test('cuentaComoAgua: agua e infusiones sí; refrescos y batidos no', () => {
  assert.ok(cuentaComoAgua('Agua mineral', 0))
  assert.ok(cuentaComoAgua('Infusión de manzanilla', 1))
  assert.ok(cuentaComoAgua('Coca-Cola Zero', 0.3))
  assert.ok(!cuentaComoAgua('Coca-Cola Original', 42))
  assert.ok(!cuentaComoAgua('Cacaolat High Protein', 59))
})

test('medidasOff: Cacaolat, Coca-Cola pack, agua y Nutella', async () => {
  const { medidasOff } = await import('../functions/api/alimentos/barcode.ts')
  assert.deepEqual(medidasOff({ quantity: '275 ml', product_quantity: 275, product_quantity_unit: 'ml', categories_tags: ['en:dairy-drinks'] }, 'Cacaolat'), { unidad: 'ml', envase: 275, racion: null, unidades: null })
  assert.deepEqual(medidasOff({ quantity: '6 x 33 cl', categories_tags: ['en:sodas'], serving_size: '330 ml' }, 'Coca-Cola'), { unidad: 'ml', envase: 330, racion: 330, unidades: 6 })
  assert.equal(medidasOff({ quantity: '1,5 l' }, 'Agua mineral').envase, 1500)
  assert.deepEqual(medidasOff({ quantity: '400 g', product_quantity: '400', serving_quantity: 15 }, 'Nutella'), { unidad: 'g', envase: 400, racion: 15, unidades: null })
  assert.equal(medidasOff({ product_quantity: 1.5, product_quantity_unit: 'l' }, 'x').envase, 1500)
})

test('preferencias de cantidades: gana lo más reciente y se limita a 200', async () => {
  const { fusionar } = await import('../src/lib/preferenciasCantidades.ts')
  const a = { aguaTodasBebidas: true, aguaT: 10, cantidades: { x: { cantidad: 275, clave: 'envase', t: 5 }, y: { cantidad: 100, t: 9 } } }
  const b = { aguaTodasBebidas: false, aguaT: 20, cantidades: { x: { cantidad: 250, clave: 'vaso', t: 7 }, y: { cantidad: 50, t: 1 } } }
  const r = fusionar(a, b)
  assert.equal(r.aguaTodasBebidas, false)
  assert.equal(r.cantidades.x!.cantidad, 250)
  assert.equal(r.cantidades.y!.cantidad, 100)
  const muchas = Object.fromEntries(Array.from({ length: 250 }, (_, i) => [`p${i}`, { cantidad: 1, t: i }]))
  const m = fusionar({ aguaTodasBebidas: false, aguaT: 0, cantidades: muchas }, { aguaTodasBebidas: false, aguaT: 0, cantidades: {} })
  assert.equal(Object.keys(m.cantidades).length, 200)
  assert.ok(m.cantidades.p249 && !m.cantidades.p0)
})
