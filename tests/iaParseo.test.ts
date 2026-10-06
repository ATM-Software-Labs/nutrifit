// Tests de limpieza/normalización de la salida de los modelos de visión.
// Ejecutar: npm test   (Node ≥ 22.18, TypeScript nativo)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ErrorParseo, extraerJson, normalizarAnalisis, parsearRespuestaModelo } from '../functions/utils/iaParseo.ts'

const BASE = {
  nombre_plato: 'Ensalada de pollo',
  ingredientes: [
    { nombre: 'Pechuga de pollo', gramos: 120, calorias: 198, proteinas: 37.2, carbohidratos: 0, grasas: 4.3 },
    { nombre: 'Lechuga', gramos: 80, calorias: 12, proteinas: 1.1, carbohidratos: 2.3, grasas: 0.2 },
  ],
  calorias: 210,
  proteinas: 38.3,
  carbohidratos: 2.3,
  grasas: 4.5,
}

test('JSON limpio', () => {
  const r = parsearRespuestaModelo(JSON.stringify(BASE))
  assert.equal(r.nombre_plato, 'Ensalada de pollo')
  assert.equal(r.calorias, 210)
  assert.equal(r.ingredientes.length, 2)
})

test('con fences ```json … ```', () => {
  const r = parsearRespuestaModelo('```json\n' + JSON.stringify(BASE, null, 2) + '\n```')
  assert.equal(r.proteinas, 38.3)
})

test('con prosa alrededor y llaves dentro de cadenas', () => {
  const obj = { ...BASE, nombre_plato: 'Plato {especial} "casero"' }
  const r = parsearRespuestaModelo(`Claro, aquí tienes el análisis:\n${JSON.stringify(obj)}\nEspero que te sirva. {nota: no es JSON}`)
  assert.equal(r.nombre_plato, 'Plato {especial} "casero"')
})

test('números como texto con unidades y coma decimal, redondeo a 1 decimal', () => {
  const r = parsearRespuestaModelo(
    '{"nombre_plato":"Tostada","ingredientes":[{"nombre":"Pan","gramos":"60 g"}],"calorias":"160 kcal","proteinas":"5,56 g","carbohidratos":30.04,"grasas":"1.98"}',
  )
  assert.deepEqual([r.calorias, r.proteinas, r.carbohidratos, r.grasas], [160, 5.6, 30, 2])
  assert.equal(r.ingredientes[0]!.gramos, 60)
  assert.equal(r.ingredientes[0]!.calorias, undefined)
})

test('coma colgante reparada', () => {
  const r = parsearRespuestaModelo('{"nombre_plato":"Yogur","ingredientes":[],"calorias":100,"proteinas":10,"carbohidratos":8,"grasas":3,}')
  assert.equal(r.calorias, 100)
})

test('totales ausentes → suma de ingredientes', () => {
  const { calorias, proteinas, carbohidratos, grasas, ...sinTotales } = BASE
  void calorias, proteinas, carbohidratos, grasas
  const r = normalizarAnalisis(sinTotales)
  assert.equal(r.calorias, 210)
  assert.equal(r.proteinas, 38.3)
})

test('respuesta envuelta {"resultado": {...}}', () => {
  const r = normalizarAnalisis({ resultado: BASE })
  assert.equal(r.nombre_plato, 'Ensalada de pollo')
})

test('HTML en nombres se elimina', () => {
  const r = normalizarAnalisis({ ...BASE, nombre_plato: '<script>alert(1)</script>Paella' })
  assert.equal(r.nombre_plato.includes('<'), false)
})

test('objeto ya parseado (modo JSON de Workers AI)', () => {
  assert.equal(parsearRespuestaModelo(BASE).grasas, 4.5)
})

test('malformado → ErrorParseo', () => {
  assert.throws(() => parsearRespuestaModelo('{"nombre_plato": "Pizza", "calorias": 800'), ErrorParseo) // sin cerrar
  assert.throws(() => parsearRespuestaModelo('Lo siento, no puedo analizar esta imagen.'), ErrorParseo) // sin JSON
  assert.throws(() => parsearRespuestaModelo('{"nombre_plato": Pizza}'), ErrorParseo) // JSON inválido
  assert.throws(() => parsearRespuestaModelo(''), ErrorParseo)
})

test('valores negativos o absurdos → ErrorParseo', () => {
  assert.throws(() => normalizarAnalisis({ ...BASE, calorias: -50 }), ErrorParseo)
  assert.throws(() => normalizarAnalisis({ ...BASE, grasas: 99999 }), ErrorParseo)
})

test('extraerJson devuelve el PRIMER objeto', () => {
  assert.deepEqual(extraerJson('a {"x":1} b {"y":2}'), { x: 1 })
})
