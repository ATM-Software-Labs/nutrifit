import { test } from 'node:test'
import assert from 'node:assert/strict'
import { aplicarRaciones, racionEnTexto } from '../functions/utils/raciones.ts'
import { PROMPT_SISTEMA_TEXTO } from '../functions/utils/ia.ts'
import type { ResultadoAnalisis } from '../functions/utils/iaParseo.ts'

function plato(descripcion: string, nombre: string, gramos: number, calorias: number, proteinas: number, carbohidratos: number, grasas: number): ResultadoAnalisis {
  return {
    input_query: descripcion,
    display_name: nombre,
    nombre_plato: nombre,
    ingredientes: [{ nombre, display_name: nombre, input_query: descripcion, gramos, min_gramos: undefined, max_gramos: undefined, calorias, proteinas, carbohidratos, grasas }],
    calorias,
    proteinas,
    carbohidratos,
    grasas,
  }
}

test('la tabla cubre las raciones de referencia', () => {
  assert.equal(racionEnTexto('un huevo')?.gramos, 58)
  assert.equal(racionEnTexto('un vaso de leche')?.gramos, 250)
  assert.equal(racionEnTexto('una taza de leche')?.serving_description, '1 vaso (~250 ml)')
  assert.equal(racionEnTexto('una cucharada de aceite')?.gramos, 12)
  assert.equal(racionEnTexto('un plátano mediano')?.gramos, 120)
  assert.equal(racionEnTexto('un plátano mediano')?.serving_description, '1 unidad mediana (~120g)')
  assert.equal(racionEnTexto('una lata de atún')?.gramos, 60)
  assert.equal(racionEnTexto('una lata de atún')?.serving_description, '1 lata escurrida (~60g)')
  assert.equal(racionEnTexto('un puñao de almendras')?.gramos, 30)
  assert.equal(racionEnTexto('un plato hondo de lentejas')?.gramos, 350)
  assert.equal(racionEnTexto('media barra de pan')?.gramos, 125)
  assert.equal(racionEnTexto('un bol de cereales con leche'), null)
})

test('2 plátanos no se quedan en 100 g y los macros escalan', () => {
  const r = aplicarRaciones('me comí 2 plátanos', plato('me comí 2 plátanos', 'Plátano', 100, 89, 1.1, 22.8, 0.3))
  const i = r.ingredientes[0]!
  assert.equal(i.gramos, 240)
  assert.equal(i.serving_description, '2 unidades medianas (~240g)')
  assert.equal(i.calorias, 213.6)
  assert.equal(i.proteinas, 2.6)
  assert.equal(i.carbohidratos, 54.7)
  assert.equal(i.grasas, 0.7)
  assert.equal(r.calorias, i.calorias)
  assert.equal(r.proteinas, i.proteinas)
  assert.equal(r.carbohidratos, i.carbohidratos)
  assert.equal(r.grasas, i.grasas)
})

test('huevo, leche, aceite, atún, filete y las medidas coloquiales escalan su propia ración', () => {
  const casos: [string, string, number, string][] = [
    ['un huevo', 'Huevo', 58, '1 unidad (~58g)'],
    ['un vaso de leche', 'Leche', 250, '1 vaso (~250 ml)'],
    ['una cucharada de aceite', 'Aceite de oliva', 12, '1 cucharada (~12g)'],
    ['una lata de atún', 'Atún', 60, '1 lata escurrida (~60g)'],
    ['un puñao de almendras', 'Almendras', 30, '1 puñado (~30g)'],
    ['un plato hondo de lentejas', 'Lentejas', 350, '1 plato hondo (~350g)'],
    ['media barra de pan', 'Pan', 125, 'media barra (~125g)'],
    ['un filete de ternera', 'Filete de ternera', 150, '1 filete (~150g)'],
  ]
  for (const [frase, nombre, gramos, desc] of casos) {
    const r = aplicarRaciones(frase, plato(frase, nombre, 100, 100, 10, 10, 10))
    assert.equal(r.ingredientes[0]?.gramos, gramos, frase)
    assert.equal(r.ingredientes[0]?.serving_description, desc, frase)
    assert.equal(r.calorias, Math.round(gramos * 10) / 10, frase)
    assert.equal(r.ingredientes[0]?.calorias, r.calorias, frase)
  }
})

test('en una frase con dos alimentos cada uno usa su ración', () => {
  const base: ResultadoAnalisis = {
    input_query: '2 huevos y una cucharada de aceite',
    display_name: 'Huevos con aceite',
    nombre_plato: 'Huevos con aceite',
    ingredientes: [
      { nombre: 'Huevo', display_name: 'Huevo', input_query: '2 huevos', gramos: 100, min_gramos: undefined, max_gramos: undefined, calorias: 143, proteinas: 12.6, carbohidratos: 0.7, grasas: 9.5 },
      { nombre: 'Aceite de oliva', display_name: 'Aceite de oliva', input_query: 'una cucharada de aceite', gramos: 100, min_gramos: undefined, max_gramos: undefined, calorias: 884, proteinas: 0, carbohidratos: 0, grasas: 100 },
    ],
    calorias: 1027,
    proteinas: 12.6,
    carbohidratos: 0.7,
    grasas: 109.5,
  }
  const r = aplicarRaciones(base.input_query, base)
  assert.equal(r.ingredientes[0]?.gramos, 116)
  assert.equal(r.ingredientes[1]?.gramos, 12)
  assert.equal(r.ingredientes[1]?.calorias, 106.1)
  assert.equal(r.calorias, Math.round(((r.ingredientes[0]?.calorias ?? 0) + (r.ingredientes[1]?.calorias ?? 0)) * 10) / 10)
  assert.equal(r.grasas, Math.round(((r.ingredientes[0]?.grasas ?? 0) + (r.ingredientes[1]?.grasas ?? 0)) * 10) / 10)
})

test('el prompt de texto incluye la tabla y prohíbe el 100 g por defecto', () => {
  assert.match(PROMPT_SISTEMA_TEXTO, /No uses 100 g por defecto/)
  assert.match(PROMPT_SISTEMA_TEXTO, /1 unidad mediana \(~120g\)/)
  assert.match(PROMPT_SISTEMA_TEXTO, /serving_description/)
  assert.match(PROMPT_SISTEMA_TEXTO, /puñao/)
  assert.match(PROMPT_SISTEMA_TEXTO, /plato hondo/)
  assert.match(PROMPT_SISTEMA_TEXTO, /media barra de pan/)
})
