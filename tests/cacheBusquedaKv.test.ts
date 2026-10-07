import { test } from 'node:test'
import assert from 'node:assert/strict'
import { foodQuery, guardarKv, leerKv, TTL_KV_BUSQUEDA_S } from '../functions/utils/cacheBusquedaKv.ts'
import { buscarOFF } from '../functions/utils/off.ts'
import type { Env } from '../functions/utils/env.ts'

test('KV: la clave de búsqueda es minúsculas, sin huecos ni acentos', () => {
  assert.equal(TTL_KV_BUSQUEDA_S, 2592000)
  assert.equal(foodQuery('  Plátano  '), 'food:platano')
  assert.equal(foodQuery('Yogur   griego'), 'food:yogur griego')
  assert.equal(foodQuery(' a '), null)
  assert.equal(foodQuery('Manzana', 'foodcat'), 'foodcat:manzana')
})

function kvMemoria() {
  const puesto: { clave: string; valor: string; ttl?: number }[] = []
  const datos = new Map<string, string>()
  const kv = {
    async get(clave: string) {
      return datos.get(clave) ?? null
    },
    async put(clave: string, valor: string, opciones?: { expirationTtl?: number }) {
      datos.set(clave, valor)
      puesto.push({ clave, valor, ttl: opciones?.expirationTtl })
    },
  }
  return { kv: kv as unknown as KVNamespace, puesto }
}

test('KV: un acierto se lee con KV.get y no toca la base', async () => {
  const { kv } = kvMemoria()
  const producto = { nombre: 'Plátano', por100: { calorias: 89, proteinas: 1.1, carbohidratos: 22.8, grasas: 0.3 } }
  await kv.put('food:platano', JSON.stringify([producto]), { expirationTtl: 2592000 })
  let d1 = 0
  const env = {
    KV: kv,
    DB: { prepare() { d1++; throw new Error('D1 no debería usarse') } },
  } as unknown as Env
  const lista = await buscarOFF('  Plátano ', { env, waitUntil() {} })
  assert.equal(lista[0]?.nombre, 'Plátano')
  assert.equal(d1, 0)
})

test('KV: sin binding la lectura sigue vacía', async () => {
  const esLista = (v: unknown): v is unknown[] => Array.isArray(v)
  assert.equal(await leerKv({} as Env, 'food:platano', esLista), null)
})

test('KV: el resultado se guarda 30 días con expirationTtl 2592000', async () => {
  const { kv, puesto } = kvMemoria()
  const pendientes: Promise<unknown>[] = []
  guardarKv({ env: { KV: kv } as Env, waitUntil(p) { pendientes.push(p) } }, 'food:yogur griego', [{ nombre: 'Yogur' }])
  await Promise.all(pendientes)
  assert.equal(puesto.length, 1)
  assert.equal(puesto[0]?.clave, 'food:yogur griego')
  assert.equal(puesto[0]?.ttl, 2592000)
  assert.deepEqual(JSON.parse(puesto[0]!.valor), [{ nombre: 'Yogur' }])
})
