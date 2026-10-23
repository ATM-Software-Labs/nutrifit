import assert from 'node:assert/strict'
import { test } from 'node:test'
import { elegirFilas, MAX_COPIA } from '../functions/utils/copiarComidas.ts'
import { copiarComidasSchema } from '../functions/utils/schemas.ts'
import type { FilaComida } from '../functions/utils/comidas.ts'

const f = (id: string, tipo: string) => ({ id, tipo_comida: tipo }) as unknown as FilaComida
const filas = [f('a', 'desayuno'), f('b', 'comida'), f('c', 'comida'), f('d', 'cena')]
const U = '0b9d6f3e-3c7c-4f5a-9d38-2f0f6a7e1b11'

test('sin filtros copia todo el día', () => assert.deepEqual(elegirFilas(filas).map((x) => x.id), ['a', 'b', 'c', 'd']))
test('filtra por tipos', () => assert.deepEqual(elegirFilas(filas, undefined, ['comida']).map((x) => x.id), ['b', 'c']))
test('ids tienen prioridad y descartan ajenos', () => assert.deepEqual(elegirFilas(filas, ['d', 'zzz'], ['comida']).map((x) => x.id), ['d']))
test('schema valida fechas, ids y límites', () => {
    assert.equal(copiarComidasSchema.safeParse({ desde: '2026-10-22', hasta: '2026-10-23' }).success, true)
    assert.equal(copiarComidasSchema.safeParse({ desde: '2026-10-22', hasta: '2026-10-23', ids: [U], tipos: ['cena'] }).success, true)
    assert.equal(copiarComidasSchema.safeParse({ desde: '2026-02-30', hasta: '2026-10-23' }).success, false)
    assert.equal(copiarComidasSchema.safeParse({ desde: '2026-10-22', hasta: '2026-10-23', ids: ['x'] }).success, false)
    assert.equal(copiarComidasSchema.safeParse({ desde: '2026-10-22', hasta: '2026-10-23', tipos: ['merienda'] }).success, false)
    assert.equal(copiarComidasSchema.safeParse({ desde: '2026-10-22', hasta: '2026-10-23', usuario_id: U }).success, false)
    assert.equal(copiarComidasSchema.safeParse({ desde: '2026-10-22', hasta: '2026-10-23', ids: Array(MAX_COPIA + 1).fill(U) }).success, false)
  })
