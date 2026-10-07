import { test } from 'node:test'
import assert from 'node:assert/strict'
import { recordarAlias, recordarAliasDelAnalisis, resolverAlias, resultadoDesdeAlias } from '../src/lib/aliasAlimentos.ts'

const memoria = new Map<string, string>()
const store = {
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
}
Object.defineProperty(globalThis, 'localStorage', { value: store, configurable: true })

test('un alias fijo se resuelve al nombre oficial sin red', () => {
  assert.equal(resolverAlias('  Péchu ')?.display_name, 'Pechuga de pollo')
  assert.equal(resolverAlias('batido prote')?.display_name, 'Proteína de suero en polvo (Whey)')
  assert.equal(resolverAlias('Tortitas   avena')?.display_name, 'Tortitas de avena caseras')
  assert.equal(resolverAlias('monstercita')?.display_name, 'Monster Energy Ultra')
  assert.equal(resolverAlias('claras')?.display_name, 'Clara de huevo pasteurizada')
  assert.equal(resolverAlias('yogur'), null)
})

test('pechu usa la pechuga de la base local, con macros, y no llama a la IA', () => {
  const r = resultadoDesdeAlias('pechu', 'Pechuga de pollo')
  assert.equal(r.input_query, 'pechu')
  assert.equal(r.display_name, 'Pechuga de pollo')
  assert.match(r.ingredientes[0]?.nombre ?? '', /Pechuga de pollo/)
  assert.ok(r.calorias > 0)
})

test('la respuesta de la IA guarda el alias y la siguiente búsqueda es local', () => {
  memoria.clear()
  assert.equal(resolverAlias('arroz basmati cocio'), null)
  recordarAliasDelAnalisis('arroz basmati cocio', {
    input_query: 'arroz basmati cocio',
    display_name: 'Arroz basmati cocido',
    nombre_plato: 'Arroz basmati cocido',
    ingredientes: [{ nombre: 'Arroz basmati cocido', display_name: 'Arroz basmati cocido', input_query: 'arroz basmati cocio', gramos: 150, calorias: 195, proteinas: 4, carbohidratos: 42, grasas: 0.5 }],
    calorias: 195,
    proteinas: 4,
    carbohidratos: 42,
    grasas: 0.5,
  })
  assert.equal(resolverAlias('Arroz basmati cocio')?.display_name, 'Arroz basmati cocido')
  recordarAlias('pechu', 'Otra cosa')
  assert.equal(resolverAlias('pechu')?.display_name, 'Pechuga de pollo')
})
