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
  assert.equal(emojiPorTexto('Nutella'), '🍽️')
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
