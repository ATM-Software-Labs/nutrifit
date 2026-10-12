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
