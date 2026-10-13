import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emojiComida, emojiDe, emojiPorTexto, esEmojiValido } from '../src/lib/miniaturaComida.ts'

test('mapeo en español e inglés con respaldo 🍽️', () => {
  assert.equal(emojiPorTexto('Pizza margarita'), '🍕')
  assert.equal(emojiPorTexto('Caesar salad'), '🥗')
  assert.equal(emojiPorTexto('Cheeseburger with fries'), '🍔')
  assert.equal(emojiPorTexto('Spaghetti carbonara'), '🍝')
  assert.equal(emojiPorTexto('Grilled salmon'), '🐟')
  assert.equal(emojiPorTexto('Scrambled eggs'), '🍳')
  assert.equal(emojiPorTexto('Banana'), '🍌')
  assert.equal(emojiPorTexto('Chocolate con leche'), '🍫')
  assert.equal(emojiPorTexto('Producto Xyz'), '🍽️')
  assert.equal(emojiComida({ descripcion: 'Steak', proteinas: 30, carbohidratos: 0, grasas: 10 }), '🥩')
})
test('emoji guardado válido gana; texto no es emoji', () => {
  assert.ok(esEmojiValido('🍽️') && esEmojiValido('🍕'))
  assert.ok(!esEmojiValido('pizza') && !esEmojiValido('') && !esEmojiValido('🍕 pizza'))
  assert.equal(emojiDe({ descripcion: 'Pizza', emoji: '🥗' }), '🥗')
  assert.equal(emojiDe({ descripcion: 'Pizza', emoji: 'x' }), '🍕')
})

import { digitoControlOk, normalizarEan, variantesEan } from '../src/lib/ean.ts'
test('EAN: control, ceros iniciales y lecturas inválidas', () => {
  assert.ok(digitoControlOk('8412700012955'))
  assert.ok(digitoControlOk('3017620422003'))
  assert.ok(!digitoControlOk('8412700012954'))
  assert.equal(normalizarEan('8412700012955'), '8412700012955')
  assert.equal(normalizarEan('08412700012955'), '8412700012955')
  assert.equal(normalizarEan('841270001295'), null)
  assert.equal(normalizarEan('036000291452'), '0036000291452')
  assert.deepEqual(variantesEan('0036000291452'), ['0036000291452', '036000291452'])
  assert.equal(normalizarEan('96385074'), '96385074')
})

import { cantidadInicial, diferencias, escalarNutrientes } from '../src/lib/editarComida.ts'
import { limpiarNombres, nombresLocales } from '../functions/utils/nombresPlato.ts'
import { comidaEditarSchema } from '../functions/utils/schemas.ts'
test('edición: escala proporcional, cantidad inicial y diferencias', () => {
  const n = { calorias: 200, proteinas: 10, carbohidratos: 20, grasas: 8, fibra: 2, azucares: null, sal: 0.5 }
  assert.deepEqual(escalarNutrientes(n, 100, 150), { calorias: 300, proteinas: 15, carbohidratos: 30, grasas: 12, fibra: 3, azucares: null, sal: 0.8 })
  assert.deepEqual(escalarNutrientes(n, 0, 150), n)
  assert.deepEqual(cantidadInicial({ ingredientes: [{ gramos: 120 }, { gramos: 30 }] }), { cantidad: 150, unidad: 'g' })
  assert.deepEqual(cantidadInicial({}), { cantidad: 1, unidad: 'racion' })
  assert.deepEqual(diferencias({ a: 1, b: 'x' }, { a: 2, b: 'x' }), { a: 2 })
})
test('PATCH valida con Zod', () => {
  assert.ok(comidaEditarSchema.safeParse({ descripcion: 'Tortilla', hora: '08:30', unidad: 'g', fibra: 3 }).success)
  assert.ok(!comidaEditarSchema.safeParse({}).success)
  assert.ok(!comidaEditarSchema.safeParse({ hora: '25:00' }).success)
  assert.ok(!comidaEditarSchema.safeParse({ calorias: -5 }).success)
  assert.ok(!comidaEditarSchema.safeParse({ usuario_id: 'x' }).success)
})
test('sugerencias de nombre: saneado y respaldo local', () => {
  assert.deepEqual(limpiarNombres('{"nombres":["Tostada con tomate","tostada con tomate","Pan tumaca", "x"]}', 'Pan'), ['Tostada con tomate', 'Pan tumaca'])
  assert.deepEqual(limpiarNombres('1. Ensalada César\n2. Ensalada de pollo', ''), ['Ensalada César', 'Ensalada de pollo'])
  assert.ok(nombresLocales('Pollo con arroz', ['Pollo', 'Arroz']).length >= 3)
})

test('recortar no parte palabras', async () => {
  const { recortar } = await import('../functions/utils/nombresPlato.ts')
  const r = recortar('Tostadas con tomate y aceite a la plancha casera')
  assert.ok(r.length <= 40 && !r.endsWith('planch'), r)
})

test('emoji de productos escaneados por nombre', () => {
  assert.equal(emojiPorTexto('Pro High Protein Sin Azucares Añadidos'), '🥛')
  assert.equal(emojiPorTexto('Nutella'), '🍫')
  assert.equal(emojiPorTexto('Tomate triturado'), '🍅')
  assert.equal(emojiPorTexto('Tostadas con tomate y aceite'), '🍞')
  assert.equal(emojiPorTexto('Barrita high protein'), '🍪')
})
