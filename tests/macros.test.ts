import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calcularMacros, calcularTMB } from '../src/lib/macros.ts'

test('Mifflin-St Jeor hombre / mujer', () => {
  // 10·80 + 6.25·180 − 5·30 + 5 = 1780
  assert.equal(calcularTMB({ edad: 30, sexo: 'hombre', peso: 80, altura: 180 }), 1780)
  // 10·60 + 6.25·165 − 5·28 − 161 = 1330.25
  assert.equal(calcularTMB({ edad: 28, sexo: 'mujer', peso: 60, altura: 165 }), 1330.25)
})

test('plan completo hombre moderado en déficit', () => {
  const p = calcularMacros({ edad: 30, sexo: 'hombre', peso: 80, altura: 180, actividad: 'moderado', objetivo: 'deficit' })
  assert.equal(p.tmb, 1780)
  assert.equal(p.tdee, 2759) // 1780 · 1.55
  assert.equal(p.calorias, 2359) // − 400
  assert.equal(p.proteinas, 144) // 1.8 g/kg
  assert.equal(p.grasas, 72) // 0.9 g/kg
  assert.equal(p.carbohidratos, Math.round((2359 - 144 * 4 - 72 * 9) / 4))
})

test('carbohidratos nunca negativos (peso muy alto + déficit)', () => {
  const p = calcularMacros({ edad: 60, sexo: 'mujer', peso: 300, altura: 150, actividad: 'sedentario', objetivo: 'deficit' })
  assert.ok(p.carbohidratos >= 0)
  assert.ok(p.grasas >= Math.round(300 * 0.6))
})

test('suelo de calorías', () => {
  const p = calcularMacros({ edad: 90, sexo: 'mujer', peso: 35, altura: 125, actividad: 'sedentario', objetivo: 'deficit' })
  assert.equal(p.calorias, 1200)
})
