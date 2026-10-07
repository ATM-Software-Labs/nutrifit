import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  alimentoDesdeBedca,
  detectarCadenas,
  escalarNutrientes,
  normalizarProductoOff,
  ordenarCatalogo,
  TTL_CATALOGO_S,
  type AlimentoCatalogo,
} from '../functions/utils/catalogoAlimentos.ts'
import { elegirCandidatos, esConsultaFresco, intentosBusqueda, nutrientesDesdeBedca, parsearDetalleBedca, parsearListaBedca, type ComponenteBedca } from '../functions/utils/bedca.ts'

test('catálogo: TTL de 30 días', () => {
  assert.equal(TTL_CATALOGO_S, 30 * 86_400)
})

test('catálogo: reconoce es:mercadona, Hacendado y el resto de cadenas', () => {
  assert.deepEqual(detectarCadenas({ stores_tags: ['es:mercadona'], brands: 'Hacendado' }), ['mercadona'])
  assert.deepEqual(detectarCadenas({ stores_tags: ['Mercadona', 'Lidl'], brands_tags: ['en:carrefour'] }), ['mercadona', 'carrefour', 'lidl'])
  assert.deepEqual(detectarCadenas({ stores: 'Caprabo, Eroski' }), ['caprabo', 'eroski'])
  assert.deepEqual(detectarCadenas({ brands: 'Dia' }), ['dia'])
  assert.deepEqual(detectarCadenas({ brands: 'radial' }), [])
})

test('catálogo: normaliza a 100 g desde la ración y calcula la porción', () => {
  const p = normalizarProductoOff({
    code: '8480000809803',
    product_name_es: 'Yogur griego',
    brands: 'Hacendado',
    stores_tags: ['es:mercadona'],
    serving_quantity: 125,
    nutriments: {
      'energy-kcal_serving': 150,
      proteins_serving: 5,
      carbohydrates_serving: 6.25,
      sugars_serving: 5,
      fat_serving: 10,
      'saturated-fat_serving': 6.25,
      fiber_serving: 0,
      salt_serving: 0.125,
    },
  })!
  assert.equal(p.cadena_prioritaria, 'mercadona')
  assert.equal(p.por_100g.energia_kcal, 120)
  assert.equal(p.por_100g.proteinas, 4)
  assert.equal(p.por_100g.azucares, 4)
  assert.equal(p.por_100g.grasas, 8)
  assert.equal(p.por_100g.grasas_saturadas, 5)
  assert.equal(p.por_100g.fibra, 0)
  assert.equal(p.por_100g.sal, 0.1)
  assert.equal(p.gramos_porcion, 125)
  assert.equal(p.por_porcion!.energia_kcal, 150)
  assert.equal(p.por_porcion!.sal, 0.13)
})

test('catálogo: kcal desde kJ y sal desde sodio, con los campos por 100 g', () => {
  const p = normalizarProductoOff({
    code: '5449000214799',
    product_name: 'Coca-Cola zero',
    product_quantity_unit: 'ml',
    quantity: '33 cl',
    nutriments: { 'energy-kj_100g': 1.3, sodium_100g: 0.008, proteins_100g: 0 },
  })!
  assert.equal(p.unidad, 'ml')
  assert.equal(p.por_100g.energia_kcal, 0.3)
  assert.equal(p.por_100g.sal, 0.02)
  assert.equal(p.gramos_porcion, 330)
})

test('catálogo: a igualdad de texto, Mercadona va antes que Lidl', () => {
  const base = (nombre: string, cadena: AlimentoCatalogo['cadena_prioritaria']): AlimentoCatalogo => ({
    id: nombre,
    codigo: null,
    nombre,
    marca: null,
    cadenas: cadena ? [cadena] : [],
    cadena_prioritaria: cadena,
    unidad: 'g',
    por_100g: { energia_kcal: 1, proteinas: 0, carbohidratos: 0, azucares: null, grasas: 0, grasas_saturadas: null, fibra: null, sal: null },
    por_porcion: null,
    gramos_porcion: null,
    fuente: 'off',
  })
  const orden = ordenarCatalogo([base('Yogur natural', 'lidl'), base('Yogur natural', 'mercadona'), base('Yogur de cabra', null)], 'yogur natural')
  assert.equal(orden[0]!.cadena_prioritaria, 'mercadona')
  assert.equal(orden[1]!.cadena_prioritaria, 'lidl')
})

test('BEDCA: la consulta de frescos no se dispara con una marca blanca', () => {
  assert.equal(esConsultaFresco('pescadilla'), true)
  assert.equal(esConsultaFresco('plátano de canarias'), true)
  assert.equal(esConsultaFresco('pechuga de pollo de corral'), true)
  assert.equal(esConsultaFresco('yogur hacendado'), false)
  assert.equal(esConsultaFresco('yogur dia'), false)
  assert.equal(esConsultaFresco('pescado del día'), true)
  assert.deepEqual(intentosBusqueda('pechuga de pollo de corral')[1], 'pechuga')
  assert.equal(intentosBusqueda('plátano de canarias').includes('platano'), true)
})

test('BEDCA: prefiere la pescadilla cruda y el plátano, no el yogur', () => {
  const xml = `
    <foodresponse>
      <food><f_id>2089</f_id><f_ori_name>Pescadilla cruda</f_ori_name></food>
      <food><f_id>567</f_id><f_ori_name>Pescadilla, rebozada en harina, frita</f_ori_name></food>
      <food><f_id>377</f_id><f_ori_name>Yogur, líquido, sabor fresa y plátano</f_ori_name></food>
      <food><f_id>2114</f_id><f_ori_name>Plátano</f_ori_name></food>
      <food><f_id>2082</f_id><f_ori_name>Pollo, pechuga, cruda</f_ori_name></food>
      <food><f_id>1371</f_id><f_ori_name>Pavo, pechuga, con piel, crudo</f_ori_name></food>
    </foodresponse>`
  const filas = parsearListaBedca(xml)
  assert.equal(elegirCandidatos('pescadilla', filas)[0]!.id, '2089')
  assert.equal(elegirCandidatos('plátano de canarias', filas)[0]!.nombre, 'Plátano')
  assert.equal(elegirCandidatos('pechuga de pollo de corral', filas)[0]!.nombre, 'Pollo, pechuga, cruda')
})

test('BEDCA: kJ, sodio y un componente no medido', () => {
  const xml = `
    <food>
      <f_id>2089</f_id>
      <f_ori_name>Pescadilla cruda</f_ori_name>
      <foodvalue><c_ori_name>energía, total</c_ori_name><best_location>320</best_location><v_unit>kJ</v_unit></foodvalue>
      <foodvalue><c_ori_name>proteina, total</c_ori_name><best_location>17,2</best_location><v_unit>g</v_unit></foodvalue>
      <foodvalue><c_ori_name>carbohidratos</c_ori_name><best_location>0</best_location><v_unit>g</v_unit></foodvalue>
      <foodvalue><c_ori_name>grasa, total (lipidos totales)</c_ori_name><best_location>1.1</best_location><v_unit>g</v_unit></foodvalue>
      <foodvalue><c_ori_name>ácidos grasos, monoinsaturados totales</c_ori_name><best_location>0.9</best_location><v_unit>g</v_unit></foodvalue>
      <foodvalue><c_ori_name>ácidos grasos saturados totales</c_ori_name><best_location>0.22</best_location><v_unit>g</v_unit></foodvalue>
      <foodvalue><c_ori_name>fibra, dietetica total</c_ori_name><best_location></best_location><v_unit>g</v_unit></foodvalue>
      <foodvalue><c_ori_name>sodio</c_ori_name><best_location>80</best_location><v_unit>mg</v_unit></foodvalue>
    </food>`
  const detalle = parsearDetalleBedca(xml)!
  const n = nutrientesDesdeBedca(detalle.componentes)
  assert.ok(Math.abs(n.energia_kcal! - 320 / 4.184) < 1e-9)
  assert.equal(n.proteinas, 17.2)
  assert.equal(n.carbohidratos, 0)
  assert.equal(n.grasas, 1.1)
  assert.equal(n.grasas_saturadas, 0.22)
  assert.equal(n.fibra, null)
  assert.equal(n.sal, 0.2)
  assert.equal(n.azucares, null)
  const alimento = alimentoDesdeBedca({ id: detalle.id, nombre: detalle.nombre, nutrientes: n, gramosPorcion: 150 })!
  assert.equal(alimento.fuente, 'bedca')
  assert.equal(alimento.por_100g.energia_kcal, 76.5)
  assert.equal(alimento.gramos_porcion, 150)
  assert.equal(alimento.por_porcion!.proteinas, 25.8)
  assert.equal(alimento.id, 'bedca:2089')
})

test('catálogo: escalar conserva los null', () => {
  const r = escalarNutrientes(
    { energia_kcal: 100, proteinas: 10, carbohidratos: null, azucares: null, grasas: 0, grasas_saturadas: null, fibra: null, sal: 1 },
    50,
  )
  assert.equal(r.energia_kcal, 50)
  assert.equal(r.carbohidratos, null)
  assert.equal(r.sal, 0.5)
})

test('BEDCA: ignora una ficha sin alimento', () => {
  assert.equal(parsearDetalleBedca('<foodresponse><food/></foodresponse>'), null)
  const vacio: ComponenteBedca[] = []
  assert.equal(nutrientesDesdeBedca(vacio).energia_kcal, null)
})
