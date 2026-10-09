import assert from 'node:assert/strict'
import { test } from 'node:test'
import { caloriasSesion, metaAgua } from '../src/lib/actividad.ts'
import { emojiMacro } from '../src/lib/miniaturaComida.ts'
import { rachaDias } from '../src/lib/racha.ts'

test('calorías locales de fuerza y cardio', () => {
  assert.equal(caloriasSesion('fuerza', 'baja', 30), 120)
  assert.equal(caloriasSesion('fuerza', 'media', 30), 195)
  assert.equal(caloriasSesion('fuerza', 'alta', 10), 85)
  assert.equal(caloriasSesion('cardio', 'baja', 10), 60)
  assert.equal(caloriasSesion('cardio', 'media', 10), 90)
  assert.equal(caloriasSesion('cardio', 'alta', 10), 120)
  assert.equal(caloriasSesion('cardio', 'alta', 0), 0)
})

test('meta de agua: peso × 35 ml, +500 fuerza y +10 ml por minuto de cardio', () => {
  assert.deepEqual(metaAgua(70, []), { base: 2450, ejercicio: 0, objetivo: 2450 })
  assert.deepEqual(metaAgua(70, [{ tipo: 'fuerza', minutos: 40 }]), { base: 2450, ejercicio: 500, objetivo: 2950 })
  assert.deepEqual(metaAgua(70, [{ tipo: 'cardio', minutos: 20 }]), { base: 2450, ejercicio: 200, objetivo: 2650 })
  assert.deepEqual(metaAgua(70, [
    { tipo: 'fuerza', minutos: 30 },
    { tipo: 'cardio', minutos: 15 },
  ]), { base: 2450, ejercicio: 650, objetivo: 3100 })
  assert.deepEqual(metaAgua(null, [{ tipo: 'fuerza', minutos: 20 }]), { base: 0, ejercicio: 500, objetivo: 500 })
  assert.equal(metaAgua(80.2, []).base, Math.round(80.2 * 35))
})

test('racha: hoy cuenta, y si hoy está vacío sigue desde ayer', () => {
  assert.equal(rachaDias([], '2026-10-09'), 0)
  assert.equal(rachaDias(['2026-10-09', '2026-10-08'], '2026-10-09'), 2)
  assert.equal(rachaDias(['2026-10-08', '2026-10-07'], '2026-10-09'), 2)
  assert.equal(rachaDias(['2026-10-07'], '2026-10-09'), 0)
  assert.equal(rachaDias(['2026-10-09', '2026-10-07'], '2026-10-09'), 1)
})

test('miniatura: el macro que más kcal aporta elige el emoji', () => {
  assert.equal(emojiMacro({ proteinas: 30, carbohidratos: 10, grasas: 5 }), '🥩')
  assert.equal(emojiMacro({ proteinas: 2, carbohidratos: 40, grasas: 1 }), '🍚')
  assert.equal(emojiMacro({ proteinas: 1, carbohidratos: 2, grasas: 20 }), '🥑')
})
