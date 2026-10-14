import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cajaDeMascara, conMargen, mascaraValida, recorteCentral } from '../src/lib/fondoBlancoGeom.ts'

test('caja de máscara y fracción', () => {
  const w = 10, h = 10, m = new Float32Array(100)
  for (let y = 3; y < 7; y++) for (let x = 2; x < 8; x++) m[y * w + x] = 0.9
  const r = cajaDeMascara(m, w, h)
  assert.deepEqual(r.caja, { x: 2, y: 3, w: 6, h: 4 })
  assert.equal(r.fraccion, 0.24)
  assert.ok(mascaraValida(r.fraccion))
  assert.ok(!mascaraValida(0.99) && !mascaraValida(0.01))
  assert.equal(cajaDeMascara(new Float32Array(4), 2, 2).caja, null)
})
test('margen ajustado a la imagen y recorte central', () => {
  assert.deepEqual(conMargen({ x: 0, y: 0, w: 50, h: 50 }, 100, 100, 0.1), { x: 0, y: 0, w: 55, h: 55 })
  assert.deepEqual(recorteCentral(1000, 500), { x: 300, y: 50, w: 400, h: 400 })
})

import { bordesTocados, componenteEn, puntuarCandidato } from '../src/lib/fondoBlancoGeom.ts'
test('componente conexa y rechazo de fondo', () => {
  const w = 8, h = 4, m = new Float32Array(w * h)
  for (const i of [9, 10, 17, 18, 14, 15]) m[i] = 1
  const c = componenteEn(m, w, h, 1, 1)!
  assert.equal(c.reduce((a, b) => a + b, 0), 4)
  assert.equal(c[14], 0)
  assert.equal(componenteEn(m, w, h, 0, 0), null)
  assert.equal(bordesTocados({ x: 0, y: 0, w: 8, h: 4 }, 8, 4), 4)
  assert.equal(puntuarCandidato({ x: 0, y: 0, w: 100, h: 100 }, 0.6, 100, 100), null)
  assert.ok(puntuarCandidato({ x: 20, y: 20, w: 50, h: 50 }, 0.2, 100, 100)! > 0)
})

test('unirRegiones junta dos tostadas separadas y descarta la región con cara', async () => {
  const { unirRegiones, componenteEn, cajaDeMascara } = await import('../src/lib/fondoBlancoGeom.ts')
  const w = 100, h = 100
  const conf = new Float32Array(w * h)
  const rect = (x0: number, y0: number, x1: number, y1: number) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) conf[y * w + x] = 0.9 }
  rect(10, 35, 40, 65); rect(60, 35, 90, 65); rect(40, 2, 60, 20)
  const a = componenteEn(conf, w, h, 25, 50)!, b = componenteEn(conf, w, h, 75, 50)!, c = componenteEn(conf, w, h, 50, 10)!
  assert.ok(cajaDeMascara(a, w, h).caja!.w < 40)
  const r = unirRegiones([{ conf, comp: a }, { conf, comp: b }, { conf, comp: c }], w, h, [{ x: 45, y: 5, w: 10, h: 10 }])!
  assert.equal(r.partes, 2)
  assert.deepEqual(r.caja, { x: 10, y: 35, w: 80, h: 30 })
  assert.equal(unirRegiones([], w, h), null)
})
