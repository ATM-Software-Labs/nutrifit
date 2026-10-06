import { test } from 'node:test'
import assert from 'node:assert/strict'
import { corregir, distancia, expresionFts, ordenar, terminos, type FilaAlimentoDB } from '../functions/utils/buscador.ts'

test('buscador: términos sin acentos ni palabras vacías', () => {
  assert.deepEqual(terminos('Pechuga de Pollo'), ['pechuga', 'pollo'])
  assert.deepEqual(terminos('  Plátano  '), ['platano'])
  assert.deepEqual(terminos('Coca-Cola Zero'), ['coca', 'cola', 'zero'])
  assert.deepEqual(terminos('a'), [])
})

test('buscador: expresión FTS segura (sin inyección de sintaxis)', () => {
  assert.equal(expresionFts(['pan'], false), '"pan"')
  assert.equal(expresionFts(['pechuga', 'pollo'], true), '"pechuga"* "pollo"*')
  assert.equal(expresionFts(['a"b'], true, 'OR'), '"ab"*')
})

test('buscador: Damerau-Levenshtein con transposición y corte', () => {
  assert.equal(distancia('merluza', 'merlusa'), 1)
  assert.equal(distancia('platano', 'paltano'), 1)
  assert.equal(distancia('lentejas', 'lentjeas'), 1)
  assert.equal(distancia('pollo', 'salmon', 2), 3)
})

test('buscador: corrige erratas con el vocabulario', () => {
  const voc = [
    { termino: 'merluza', n: 9 },
    { termino: 'merengue', n: 2 },
    { termino: 'platano', n: 29 },
    { termino: 'lentejas', n: 12 },
  ]
  assert.equal(corregir('merlusa', voc), 'merluza')
  assert.equal(corregir('platno', voc), 'platano')
  assert.equal(corregir('lentehas', voc), 'lentejas')
  assert.equal(corregir('merluza', voc), null) // ya existe
  assert.equal(corregir('plat', voc), null) // prefijo: lo resuelve FTS
  assert.equal(corregir('xyzw', voc), null)
})

const fila = (id: number, nombre: string, o: Partial<FilaAlimentoDB> = {}): FilaAlimentoDB => ({
  id, fuente: 'usda-sr', fuente_id: String(id), nombre, nombre_orig: '', sinonimos: '', categoria: 0, kcal: 100, proteinas: 1, carbohidratos: 1, grasas: 1,
  azucares: null, saturadas: null, fibra: null, sal: null, traducido: 1, prioridad: 1, ...o,
})

test('buscador: ranking prioriza palabra exacta, nombre corto y alimento base', () => {
  const r = ordenar(
    [
      fila(1, 'Panceta de cerdo curada, frita'),
      fila(2, 'Pan blanco', { prioridad: 3 }),
      fila(3, 'Pan de molde integral tostado'),
      fila(4, 'Empanada de atún'),
    ],
    ['pan'],
    'pan',
  )
  assert.equal(r[0]!.id, 2)
  assert.equal(r.at(-1)!.id === 1 || r.at(-1)!.id === 4, true)

  const p = ordenar([fila(10, 'Plátano macho, frito'), fila(11, 'Plátano, crudo', { prioridad: 2 }), fila(12, 'Chips de plátano', { traducido: 0 })], ['platano'], 'plátano')
  assert.equal(p[0]!.id, 11)
  assert.equal(p.at(-1)!.id, 12)

  const pp = ordenar([fila(20, 'Pollo, carne y piel, asado'), fila(21, 'Pechuga de pollo, cruda', { prioridad: 2 })], ['pechuga', 'pollo'], 'pechuga de pollo')
  assert.equal(pp[0]!.id, 21)
})

test('buscador: elimina duplicados de las consultas exacta + prefijo', () => {
  assert.equal(ordenar([fila(1, 'Lentejas, cocidas'), fila(1, 'Lentejas, cocidas')], ['lentejas'], 'lentejas').length, 1)
})
