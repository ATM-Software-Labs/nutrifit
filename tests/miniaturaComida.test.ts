import assert from 'node:assert/strict'
import { test } from 'node:test'
import { emojiComida, esFotoReal } from '../src/lib/miniaturaComida.ts'

test('la foto real tiene prioridad sobre un emoji', () => {
  assert.equal(esFotoReal('data:image/webp;base64,AAAA'), true)
  assert.equal(esFotoReal('blob:http://localhost/8c1d'), true)
  assert.equal(esFotoReal('/api/archivos/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'), true)
  assert.equal(esFotoReal('https://nutri.trujillomingorance.com/foto.webp'), true)
  assert.equal(esFotoReal('http://evil.test/a.jpg'), false)
  assert.equal(esFotoReal(''), false)
  assert.equal(esFotoReal(null), false)
})

test('el emoji sigue la palabra, no el macro mayoritario', () => {
  const kcal = { proteinas: 30, carbohidratos: 10, grasas: 5 }
  assert.equal(emojiComida({ descripcion: 'Café con leche', ...kcal }), '☕')
  assert.equal(emojiComida({ descripcion: 'Zumo de naranja', ...kcal }), '🧃')
  assert.equal(emojiComida({ descripcion: 'Refresco de cola', ...kcal }), '🥤')
  assert.equal(emojiComida({ descripcion: 'Hamburguesa completa de ternera', ...kcal }), '🍔')
  assert.equal(emojiComida({ descripcion: 'Sándwich mixto integral', ...kcal }), '🥪')
  assert.equal(emojiComida({ descripcion: 'Caldo de carne', ...kcal }), '🍲')
  assert.equal(emojiComida({ descripcion: 'Pechuga de pollo a la plancha', ...kcal }), '🥩')
  assert.equal(emojiComida({ descripcion: 'Langostinos a la plancha', ...kcal }), '🦐')
  assert.equal(emojiComida({ descripcion: 'Salmón al horno', ...kcal }), '🐟')
  assert.equal(emojiComida({ descripcion: 'Manzana', ...kcal }), '🍎')
  assert.equal(emojiComida({ descripcion: 'Plátano', ...kcal }), '🍌')
  assert.equal(emojiComida({ descripcion: 'Patatas cocidas', ...kcal }), '🥔')
  assert.equal(emojiComida({ descripcion: 'Arroz con pollo', ...kcal }), '🍚')
  assert.equal(emojiComida({ descripcion: 'Espaguetis a la boloñesa', ...kcal }), '🍝')
  assert.equal(emojiComida({ descripcion: 'Queso manchego', ...kcal }), '🧀')
  assert.equal(emojiComida({ descripcion: 'Yogur natural', ...kcal }), '🥛')
})

test('desayuno, café, bollería y arroz no caen en el icono por macro', () => {
  const graso = { proteinas: 2, carbohidratos: 5, grasas: 20 }
  assert.equal(emojiComida({ descripcion: 'Cruasán de mantequilla', ...graso }), '🥐')
  assert.equal(emojiComida({ descripcion: 'Croissant', ...graso }), '🥐')
  assert.equal(emojiComida({ descripcion: 'Café solo', ...graso }), '☕')
  assert.equal(emojiComida({ descripcion: 'Arroz basmati', ...graso }), '🍚')
  assert.equal(emojiComida({ descripcion: 'Tortitas de avena', ...graso }), '🥞')
  assert.equal(emojiComida({ descripcion: 'Churros', ...graso }), '🍩')
  assert.equal(emojiComida({ descripcion: 'Colacao', ...graso }), '☕')
  assert.equal(emojiComida({ descripcion: 'Gazpacho', ...graso }), '🍲')
})

test('sin palabra reconocible usa la categoría y, si falta, el macro', () => {
  assert.equal(emojiComida({ descripcion: 'Ración del día', categoria: 'verdura', proteinas: 30, carbohidratos: 1, grasas: 1 }), '🥦')
  assert.equal(emojiComida({ descripcion: 'Ración del día', categoria: 'bebida', proteinas: 0, carbohidratos: 20, grasas: 0 }), '🥤')
  assert.equal(emojiComida({ descripcion: 'Ración del día', proteinas: 2, carbohidratos: 40, grasas: 1 }), '🍚')
  assert.equal(emojiComida({ descripcion: 'Hamburguesa', categoria: 'carne', proteinas: 1, carbohidratos: 40, grasas: 1 }), '🍔')
})
