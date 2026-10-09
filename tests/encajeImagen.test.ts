import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CALIDAD_FOTO, CALIDAD_JPEG, encajeCuadrado, encajeLadoMayor, LADO_JPEG, LADO_MAYOR, MAX_FOTO_BYTES } from '../src/lib/encajeImagen.ts'

test('el JPEG del plato es un cuadrado de 1024 a calidad 0.85', () => {
  assert.equal(LADO_JPEG, 1024)
  assert.equal(CALIDAD_JPEG, 0.85)
})

test('encaja sin recortar ni ampliar', () => {
  assert.deepEqual(encajeCuadrado(4000, 3000), { lado: 1024, w: 1024, h: 768, x: 0, y: 128 })
  assert.deepEqual(encajeCuadrado(3000, 4000), { lado: 1024, w: 768, h: 1024, x: 128, y: 0 })
  assert.deepEqual(encajeCuadrado(1024, 1024), { lado: 1024, w: 1024, h: 1024, x: 0, y: 0 })
  assert.deepEqual(encajeCuadrado(800, 600), { lado: 1024, w: 800, h: 600, x: 112, y: 212 })
})

test('la foto de análisis cabe en 800 px por el lado mayor, a calidad 0.75', () => {
  assert.equal(LADO_MAYOR, 800)
  assert.equal(CALIDAD_FOTO, 0.75)
  assert.equal(MAX_FOTO_BYTES, 100 * 1024)
  assert.deepEqual(encajeLadoMayor(4000, 3000), { w: 800, h: 600 })
  assert.deepEqual(encajeLadoMayor(3000, 4000), { w: 600, h: 800 })
  assert.deepEqual(encajeLadoMayor(800, 800), { w: 800, h: 800 })
  assert.deepEqual(encajeLadoMayor(400, 200), { w: 400, h: 200 })
})
