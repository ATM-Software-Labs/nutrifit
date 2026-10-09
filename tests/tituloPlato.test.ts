import assert from 'node:assert/strict'
import { test } from 'node:test'
import { categoriaDe, descripcionPlato, tituloGastronomico } from '../functions/utils/tituloPlato.ts'

test('una lista de ingredientes se convierte en un título de plato', () => {
  assert.equal(tituloGastronomico('Pan de hamburguesa, Carne de res para hamburguesa'), 'Hamburguesa completa de ternera')
  assert.equal(tituloGastronomico('Pan integral, Jamón york, Queso en lonchas'), 'Sándwich mixto integral')
  assert.equal(tituloGastronomico('Carne de ternera, Patatas cocidas, Zanahoria, Cebolla'), 'Guiso de carne con patatas y verduras')
  assert.equal(tituloGastronomico('', ['Arroz blanco hervido', 'Pechuga de pollo a la plancha', 'Aceite de oliva']), 'Arroz con pollo')
})

test('un nombre ya gastronómico se conserva y no pasa de 40 caracteres', () => {
  assert.equal(tituloGastronomico('Pechuga de pollo a la plancha'), 'Pechuga de pollo a la plancha')
  assert.equal(tituloGastronomico('Cruasán de mantequilla'), 'Cruasán de mantequilla')
  const largo = tituloGastronomico('Bebida energética Monster Energy Ultra Zero')
  assert.ok(largo.length <= 40)
  assert.equal(largo.includes(','), false)
  assert.match(largo, /^Bebida energética Monster/)
})

test('el desglose queda en descripcion y la categoría es del enum', () => {
  const nombres = ['Pan de hamburguesa', 'Carne de res']
  const titulo = tituloGastronomico('Pan de hamburguesa, Carne de res', nombres)
  const descripcion = descripcionPlato('Pan de hamburguesa, Carne de res', nombres)
  assert.equal(titulo.includes(','), false)
  assert.match(descripcion, /Pan de hamburguesa/)
  assert.equal(categoriaDe([titulo, ...nombres], nombres.length), 'plato_elaborado')
  assert.equal(categoriaDe(['Café con leche'], 1), 'bebida')
  assert.equal(categoriaDe(['Yogur natural'], 1), 'lacteo')
  assert.equal(categoriaDe(['Manzana'], 1), 'fruta')
  assert.equal(categoriaDe(['Langostinos a la plancha'], 1), 'pescado_marisco')
  assert.equal(categoriaDe(['Cruasán de mantequilla'], 1), 'panaderia')
})
