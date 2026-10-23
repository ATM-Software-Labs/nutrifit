import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ajustarMetas, bitDia, PLAN_VACIO, tipoEfectivo } from '../functions/utils/planDia.ts'
import { planDiaSchema, tipoDiaSchema } from '../functions/utils/schemas.ts'

const base = { calorias: 2000, proteinas: 120, carbohidratos: 220, grasas: 65 }
const plan = { ...PLAN_VACIO, horario_entreno: 1 | 4 | 16, entreno_kcal: 300, entreno_carbs: 60, descanso_kcal: -200, descanso_carbs: -40 }

test('bit del día: 2026-10-19 lunes, 2026-10-25 domingo', () => {
  assert.equal(bitDia('2026-10-19'), 1)
  assert.equal(bitDia('2026-10-23'), 16)
  assert.equal(bitDia('2026-10-25'), 64)
})
test('sin plan ni marca: día normal y metas iguales', () => {
  assert.deepEqual(tipoEfectivo(null, null, '2026-10-23'), { tipo: null, origen: null })
  assert.deepEqual(ajustarMetas(base, null, null), base)
  assert.deepEqual(tipoEfectivo(PLAN_VACIO, null, '2026-10-23'), { tipo: null, origen: null })
})
test('horario automático: viernes entreno, sábado descanso', () => {
  assert.deepEqual(tipoEfectivo(plan, null, '2026-10-23'), { tipo: 'entreno', origen: 'horario' })
  assert.deepEqual(tipoEfectivo(plan, null, '2026-10-24'), { tipo: 'descanso', origen: 'horario' })
  assert.deepEqual(tipoEfectivo({ ...plan, auto: 0 }, null, '2026-10-23'), { tipo: null, origen: null })
})
test('la marca manual gana al horario', () => {
  assert.deepEqual(tipoEfectivo(plan, 'descanso', '2026-10-23'), { tipo: 'descanso', origen: 'manual' })
})
test('ajuste de metas por tipo, sin negativos', () => {
  assert.deepEqual(ajustarMetas(base, plan, 'entreno'), { calorias: 2300, proteinas: 120, carbohidratos: 280, grasas: 65 })
  assert.deepEqual(ajustarMetas(base, plan, 'descanso'), { calorias: 1800, proteinas: 120, carbohidratos: 180, grasas: 65 })
  assert.equal(ajustarMetas({ ...base, carbohidratos: 10 }, plan, 'descanso').carbohidratos, 0)
})
test('schemas', () => {
  assert.equal(tipoDiaSchema.safeParse({ fecha: '2026-10-23', tipo: null }).success, true)
  assert.equal(tipoDiaSchema.safeParse({ fecha: '2026-10-23', tipo: 'siesta' }).success, false)
  const d = { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 }
  assert.equal(planDiaSchema.safeParse({ horario_entreno: 21, auto: true, entreno: d, descanso: d, nombres: { snack: 'Merienda' }, porcion_g: 150 }).success, true)
  assert.equal(planDiaSchema.safeParse({ horario_entreno: 128, auto: true, entreno: d, descanso: d }).success, false)
  assert.equal(planDiaSchema.safeParse({ horario_entreno: 1, auto: true, entreno: { ...d, calorias: 5000 }, descanso: d }).success, false)
})
