import { test } from 'node:test'
import assert from 'node:assert/strict'
import { escalar } from '../src/lib/buscarAlimentos.ts'
import { filtrarHistorial, recordarAlimento } from '../src/lib/historialAlimentos.ts'
import { sugerir, type EntradaHistorial } from '../src/lib/sugerenciasAlimento.ts'

const memoria = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (k: string) => memoria.get(k) ?? null,
    setItem: (k: string, v: string) => {
      memoria.set(k, v)
    },
    removeItem: (k: string) => {
      memoria.delete(k)
    },
    clear: () => memoria.clear(),
    key: () => null,
    length: 0,
  },
  configurable: true,
})

test('pla devuelve como mucho 5 e incluye el plátano por ración', () => {
  const r = sugerir('pla', [])
  assert.ok(r.length >= 1 && r.length <= 5)
  const platano = r.find((a) => a.nombre === 'Plátano')
  assert.ok(platano)
  assert.equal(platano.racion, 120)
  const m = escalar(platano.por100, platano.racion ?? 100)
  assert.equal(m.calorias, 107)
  assert.equal(m.proteinas, 1.3)
  assert.equal(m.carbohidratos, 27.4)
  assert.equal(m.grasas, 0.4)
})

test('pechu usa el alias y devuelve pechuga, sin red', () => {
  const r = sugerir('pechu', [])
  assert.ok(r.length <= 5)
  assert.match(r[0]?.nombre ?? '', /Pechuga de pollo/)
  assert.equal(r[0]?.racion, 150)
})

test('una sola letra no abre sugerencias', () => {
  assert.deepEqual(sugerir('p', [{ nombre: 'Plátano', por100: { calorias: 89, proteinas: 1.1, carbohidratos: 22.8, grasas: 0.3 }, racion: 120, veces: 9 }]), [])
})

test('el historial del usuario queda por delante de la base', () => {
  const historial: EntradaHistorial[] = [
    { nombre: 'Plato de la abuela', por100: { calorias: 100, proteinas: 8, carbohidratos: 10, grasas: 4 }, racion: 250, veces: 2 },
    { nombre: 'Plátano', por100: { calorias: 90, proteinas: 1, carbohidratos: 20, grasas: 0 }, racion: 120, veces: 6 },
  ]
  const r = sugerir('pla', historial)
  assert.equal(r[0]?.nombre, 'Plátano')
  assert.equal(r[0]?.id.startsWith('hist-'), true)
  assert.equal(r[0]?.por100.calorias, 90)
  assert.equal(r[1]?.nombre, 'Plato de la abuela')
  assert.ok(r.length <= 5)
  assert.equal(new Set(r.map((a) => a.nombre)).size, r.length)
})

test('el historial se recuerda en local y descarta basura', () => {
  memoria.clear()
  const lista = recordarAlimento({ nombre: 'Plátano', por100: { calorias: 89, proteinas: 1.1, carbohidratos: 22.8, grasas: 0.3 }, racion: 120 })
  const otra = recordarAlimento({ nombre: 'plátano', por100: { calorias: 89, proteinas: 1.1, carbohidratos: 22.8, grasas: 0.3 }, racion: 120 })
  assert.equal(lista.length, 1)
  assert.equal(otra[0]?.veces, 2)
  assert.equal(filtrarHistorial([{ nombre: 'x' }, null, { nombre: 'Pan', por100: { calorias: 1, proteinas: 1, carbohidratos: 1, grasas: 1 }, racion: null, veces: 1 }]).length, 1)
})
