// Base de alimentos local (búsqueda y escalado) y periodos del historial.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ALIMENTOS, CATEGORIAS } from '../src/data/alimentos.ts'
import { buscarLocal, escalar, normalizar } from '../src/lib/buscarAlimentos.ts'
import { moverPeriodo, periodo } from '../src/lib/periodos.ts'

test('base de alimentos: 300–500 filas válidas por 100 g y nombres únicos', () => {
  assert.ok(ALIMENTOS.length >= 300 && ALIMENTOS.length <= 500, `filas: ${ALIMENTOS.length}`)
  const nombres = new Set<string>()
  for (const [nombre, cat, kcal, p, c, g, racion, fdc] of ALIMENTOS) {
    assert.ok(!nombres.has(nombre), `duplicado: ${nombre}`)
    nombres.add(nombre)
    assert.ok(CATEGORIAS[cat], nombre)
    assert.ok(kcal >= 0 && kcal <= 902 && p <= 100 && c <= 100 && g <= 100, nombre)
    // Coherencia aproximada Atwater (alcohol y fibra aparte): kcal ≈ 4P + 4C + 9G
    if (!/vino|cerveza|ginebra|vermut|cava|cacao puro/i.test(nombre)) assert.ok(Math.abs(4 * p + 4 * c + 9 * g - kcal) <= Math.max(40, kcal * 0.25), `${nombre}: ${kcal} vs ${4 * p + 4 * c + 9 * g}`)
    assert.ok(racion > 0 && fdc > 100000, nombre)
  }
})

test('buscarLocal: sin acentos, por inicio de palabra y por categoría', () => {
  assert.equal(normalizar('Plátano  Macho!'), 'platano macho')
  assert.equal(buscarLocal('platano')[0]?.nombre, 'Plátano')
  assert.ok(buscarLocal('pollo plancha').some((a) => a.nombre === 'Pechuga de pollo a la plancha'))
  assert.deepEqual(buscarLocal('zzzz'), [])
  const frutas = buscarLocal('', CATEGORIAS.indexOf('Frutas'), 500)
  assert.ok(frutas.length > 20 && frutas.every((a) => a.detalle === 'Frutas'))
})

test('escalar: macros proporcionales a los gramos', () => {
  assert.deepEqual(escalar({ calorias: 130, proteinas: 2.7, carbohidratos: 28.2, grasas: 0.3 }, 180), { calorias: 234, proteinas: 4.9, carbohidratos: 50.8, grasas: 0.5 })
})

test('periodos: semana lunes–domingo y mes natural', () => {
  assert.deepEqual(periodo('semana', '2026-10-06').desde, '2026-10-05')
  assert.deepEqual(periodo('semana', '2026-10-06').hasta, '2026-10-11')
  assert.deepEqual([periodo('mes', '2026-02-14').desde, periodo('mes', '2026-02-14').hasta], ['2026-02-01', '2026-02-28'])
  assert.equal(periodo('mes', '2026-10-06').etiqueta, 'Octubre de 2026')
  assert.equal(moverPeriodo('mes', '2026-01-31', 1), '2026-02-01')
  assert.equal(moverPeriodo('semana', '2026-10-06', -1), '2026-09-29')
})
