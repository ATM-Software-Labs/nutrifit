import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CALIDAD_FOTO, CALIDAD_JPEG, CALIDAD_MIN, encajeCuadrado, encajeLadoMayor, LADO_FOTO, LADO_JPEG, LADO_MAYOR, MAX_FOTO_BYTES } from '../src/lib/encajeImagen.ts'
import { elegirBinario } from '../src/lib/bucleFoto.ts'

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

test('la foto de análisis empieza en 1024 px, baja a 800 y no pasa de 130 KB', () => {
  assert.equal(LADO_FOTO, 1024)
  assert.equal(LADO_MAYOR, 800)
  assert.equal(CALIDAD_FOTO, 0.75)
  assert.equal(MAX_FOTO_BYTES, 130 * 1024)
  assert.deepEqual(encajeLadoMayor(4000, 3000, LADO_FOTO), { w: 1024, h: 768 })
  assert.deepEqual(encajeLadoMayor(4000, 3000), { w: 800, h: 600 })
  assert.deepEqual(encajeLadoMayor(3000, 4000), { w: 600, h: 800 })
  assert.deepEqual(encajeLadoMayor(800, 800), { w: 800, h: 800 })
  assert.deepEqual(encajeLadoMayor(400, 200), { w: 400, h: 200 })
})

test('si ya cabe, no se amplía; si no, baja el lado antes de salir de 0.72', async () => {
  const pequena = await elegirBinario(400, 200, async () => new Blob([new Uint8Array(40 * 1024)]))
  assert.ok(pequena)
  assert.equal(pequena!.size, 40 * 1024)

  const calidades: number[] = []
  const anchos: number[] = []
  const grande = await elegirBinario(4000, 3000, async (w, _h, calidad) => {
    anchos.push(w)
    calidades.push(calidad)
    return new Blob([new Uint8Array(w > 800 ? 200 * 1024 : 90 * 1024)])
  })
  assert.equal(anchos[0], 1024)
  assert.equal(anchos[1], 800)
  assert.ok(calidades[0]! >= CALIDAD_MIN)
  assert.ok(grande && grande.size <= MAX_FOTO_BYTES)
})
