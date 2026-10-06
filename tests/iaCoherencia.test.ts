// Comprobaciones de sentido común del análisis (Atwater, raciones, alcohol).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { revisarAnalisis } from '../functions/utils/iaCoherencia.ts'
import { ErrorParseo, type ResultadoAnalisis } from '../functions/utils/iaParseo.ts'

type Ing = ResultadoAnalisis['ingredientes'][number]
const ing = (o: Partial<Ing>) => o as Ing

const base = (o: Partial<ResultadoAnalisis> = {}): ResultadoAnalisis => ({
  nombre_plato: 'Tostada con aceite',
  ingredientes: [
    { nombre: 'Pan', gramos: 60, calorias: 160, proteinas: 5.4, carbohidratos: 29, grasas: 1.9 },
    { nombre: 'Aceite de oliva', gramos: 10, calorias: 88, proteinas: 0, carbohidratos: 0, grasas: 10 },
  ],
  calorias: 248,
  proteinas: 5.4,
  carbohidratos: 29,
  grasas: 11.9,
  ...o,
})

test('coherente → sin cambios', () => {
  assert.deepEqual(revisarAnalisis(base()), base())
})

test('totales ≠ suma de ingredientes → manda la suma', () => {
  const r = revisarAnalisis(base({ proteinas: 20, calorias: 400 }))
  assert.equal(r.proteinas, 5.4)
  assert.equal(r.calorias, 248)
})

test('kcal algo desviadas de 4P+4C+9G (sin ingredientes) → se corrigen', () => {
  const r = revisarAnalisis(base({ ingredientes: [], calorias: 330 }))
  assert.equal(r.calorias, 244.7)
})

test('kcal absurdas (×2) → ErrorParseo', () => {
  assert.throws(() => revisarAnalisis(base({ ingredientes: [], calorias: 900 })), ErrorParseo)
})

test('bebidas alcohólicas no se corrigen por Atwater', () => {
  const r = revisarAnalisis({ nombre_plato: 'Caña de cerveza', ingredientes: [{ nombre: 'Cerveza', gramos: 200, calorias: 86, proteinas: 0.9, carbohidratos: 7, grasas: 0 }], calorias: 86, proteinas: 0.9, carbohidratos: 7, grasas: 0 })
  assert.equal(r.calorias, 86)
})

test('ingrediente imposible o ración inverosímil → ErrorParseo', () => {
  assert.throws(() => revisarAnalisis(base({ ingredientes: [ing({ nombre: 'Pan', gramos: 10, proteinas: 30, carbohidratos: 0, grasas: 0 })] })), ErrorParseo)
  assert.throws(() => revisarAnalisis(base({ ingredientes: [ing({ nombre: 'Pan', gramos: 10, calorias: 500 })] })), ErrorParseo)
  assert.throws(() => revisarAnalisis(base({ ingredientes: [ing({ nombre: 'Arroz', gramos: 3500 })] })), ErrorParseo)
})

test('kcal de ingrediente ausentes → Atwater', () => {
  const r = revisarAnalisis(base({ ingredientes: [ing({ nombre: 'Aceite', gramos: 10, proteinas: 0, carbohidratos: 0, grasas: 10 })], calorias: 90, proteinas: 0, carbohidratos: 0, grasas: 10 }))
  assert.equal(r.ingredientes[0]!.calorias, 90)
})

test('«Sin comida» con ceros pasa', () => {
  const r = revisarAnalisis({ nombre_plato: 'Sin comida', ingredientes: [], calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 })
  assert.equal(r.calorias, 0)
})
