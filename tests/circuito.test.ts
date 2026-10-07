import { test } from 'node:test'
import assert from 'node:assert/strict'
import { crearCircuitos } from '../functions/utils/circuito.ts'

test('abre tras el umbral, sonda una vez y los gateways no se mezclan', () => {
  let t = 1_000
  const c = crearCircuitos({ umbral: 3, enfriamientoMs: 500, ahora: () => t })

  assert.equal(c.permite('gemini'), true)
  c.fallo('gemini')
  c.fallo('gemini')
  assert.equal(c.permite('gemini'), true)
  c.fallo('gemini')
  assert.equal(c.permite('gemini'), false)
  assert.equal(c.permite('groq'), true)

  t += 499
  assert.equal(c.permite('gemini'), false)
  t += 1
  assert.equal(c.permite('gemini'), true)
  assert.equal(c.permite('gemini'), false)

  c.fallo('gemini')
  assert.equal(c.permite('gemini'), false)

  t += 500
  assert.equal(c.permite('gemini'), true)
  c.exito('gemini')
  assert.equal(c.permite('gemini'), true)
  c.fallo('gemini')
  assert.equal(c.permite('gemini'), true)
})

test('liberar la sonda no cuenta como fallo', () => {
  let t = 0
  const c = crearCircuitos({ umbral: 1, enfriamientoMs: 100, ahora: () => t })
  c.fallo('groq')
  t = 100
  assert.equal(c.permite('groq'), true)
  c.liberarSonda('groq')
  assert.equal(c.permite('groq'), true)
})
