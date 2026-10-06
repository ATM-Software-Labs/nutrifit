import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EtiquetaNoLegible, NoEsTabla, kcalAtwater, normalizarEtiqueta, revisarPor100 } from '../functions/utils/etiqueta.ts'

// Tortillas Old El Paso (lectura real de gemma-4 en la prueba): 302 kcal/100 g, ración 24 g.
const TORTILLA = {
  es_tabla: true,
  nombre: 'Fajitas',
  marca: 'Old El Paso',
  unidad: 'g',
  por_100: { kcal: 302, kj: 1276, proteinas: 9.3, carbohidratos: 47.9, azucares: 2.0, grasas: 7, saturadas: 1, fibra: 5.3, sal: 1.0 },
  por_racion: { kcal: 73, proteinas: 2.2, carbohidratos: 11.6, azucares: 0.5, grasas: 1.7, saturadas: 0.2, fibra: 1.3, sal: 0.24 },
  racion: 24,
}

test('etiqueta: lectura coherente sin advertencias', () => {
  const e = normalizarEtiqueta(TORTILLA)
  assert.equal(e.por100.calorias, 302)
  assert.equal(e.por100.sal, 1)
  assert.equal(e.racion, 24)
  assert.equal(e.porRacion?.calorias, 73)
  assert.equal(e.marca, 'Old El Paso')
  assert.deepEqual(e.advertencias, [])
})

test('etiqueta: números en texto, comas, "<0,01" y kJ→kcal', () => {
  const e = normalizarEtiqueta({ por_100: { kj: '218 kJ', proteinas: '0,7 g', carbohidratos: '11', azucares: '10', grasas: '<0,5', saturadas: 'trazas', fibra: '2,4', sal: '<0,01' } })
  assert.equal(e.por100.calorias, 52.1)
  assert.equal(e.por100.proteinas, 0.7)
  assert.equal(e.por100.grasas, 0)
  assert.equal(e.por100.sal, 0)
  assert.equal(e.unidad, 'g')
})

test('etiqueta: solo columna por ración → calcula por 100 g y avisa', () => {
  const e = normalizarEtiqueta({ por_racion: { kcal: 150, proteinas: 6, carbohidratos: 20, grasas: 5 }, racion: 50 })
  assert.equal(e.por100.calorias, 300)
  assert.equal(e.por100.proteinas, 12)
  assert.match(e.advertencias[0]!, /calculados a partir de la ración de 50 g/)
})

test('etiqueta: sodio → sal y ración derivada de por 100 g', () => {
  const e = normalizarEtiqueta({ por_100: { kcal: 100, proteinas: 5, carbohidratos: 10, grasas: 4.4, sodio: 0.4 }, racion: 30 })
  assert.equal(e.por100.sal, 1)
  assert.equal(e.porRacion?.calorias, 30)
  assert.equal(e.porRacion?.proteinas, 1.5)
})

test('etiqueta: valores imposibles o no es una tabla → error', () => {
  assert.throws(() => normalizarEtiqueta({ por_100: { kcal: 300, proteinas: 120, carbohidratos: 10, grasas: 1 } }), EtiquetaNoLegible)
  assert.throws(() => normalizarEtiqueta({ por_100: { kcal: 1200, proteinas: 10, carbohidratos: 10, grasas: 90 } }), EtiquetaNoLegible)
  assert.throws(() => normalizarEtiqueta({ es_tabla: false }), NoEsTabla)
  assert.throws(() => normalizarEtiqueta({ por_100: { kcal: 200 } }), EtiquetaNoLegible)
  assert.throws(() => normalizarEtiqueta('hola'), EtiquetaNoLegible)
  assert.equal((new NoEsTabla('x') as unknown as { definitivo: boolean }).definitivo, true)
})

test('etiqueta: incoherencias se avisan pero no bloquean', () => {
  const e = normalizarEtiqueta({ por_100: { kcal: 500, proteinas: 5, carbohidratos: 10, azucares: 20, grasas: 2, saturadas: 4 }, racion: 30, por_racion: { kcal: 60, proteinas: 1.5, carbohidratos: 3, grasas: 0.6 } })
  assert.ok(e.advertencias.some((a) => /azúcares superan/.test(a)))
  assert.ok(e.advertencias.some((a) => /saturadas superan/.test(a)))
  assert.ok(e.advertencias.some((a) => /no cuadran con los macros/.test(a)))
  assert.ok(e.advertencias.some((a) => /por ración no cuadra/.test(a)))
})

test('etiqueta: Atwater y tolerancia (máx. 15 kcal o 15 %)', () => {
  assert.equal(kcalAtwater({ proteinas: 10, carbohidratos: 10, grasas: 10, fibra: 5 }), 180)
  assert.deepEqual(revisarPor100({ calorias: 52, proteinas: 0.7, carbohidratos: 11, grasas: 0, azucares: 10, saturadas: 0, fibra: 2.4, sal: 0 }).avisos, [])
  assert.equal(revisarPor100({ calorias: 0.3, proteinas: 0, carbohidratos: 0, grasas: 0, azucares: 0, saturadas: 0, fibra: null, sal: 0.02 }).avisos.length, 0)
})
