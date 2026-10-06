/** Historial (agregación + endpoint) y exportación CSV. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { agregarHistorial, diasEntre } from '../functions/utils/historial.ts'
import { celdaCsv, generarCsv, nombreArchivo } from '../functions/utils/csv.ts'
import { onRequestGet as getHistorial } from '../functions/api/historial.ts'
import { onRequestGet as getExportar } from '../functions/api/exportar.ts'
import { historialQuery, exportarQuery } from '../functions/utils/schemas.ts'
import { capturar, ctx, entornoTest } from './d1Sqlite.ts'

test('diasEntre: incluye extremos y cruza el cambio de hora', () => {
  const d = diasEntre('2026-10-24', '2026-10-27')
  assert.deepEqual(d, ['2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27'])
  assert.equal(diasEntre('2026-02-01', '2026-02-28').length, 28)
})

test('agregarHistorial: ceros, medias sobre días con registro, objetivo y peso', () => {
  const metas = { calorias: 2000, proteinas: 120, carbohidratos: 220, grasas: 60 }
  const h = agregarHistorial(
    '2026-10-01',
    '2026-10-07',
    [
      { fecha: '2026-10-01', calorias: 1950, proteinas: 110, carbohidratos: 200, grasas: 60, num_comidas: 3 },
      { fecha: '2026-10-03', calorias: 2500.44, proteinas: 130, carbohidratos: 300, grasas: 80, num_comidas: 4 },
    ],
    [{ fecha: '2026-10-01', ml: 2000 }, { fecha: '2026-10-02', ml: 1000 }],
    [{ fecha: '2026-10-01', peso: 70.4 }, { fecha: '2026-10-06', peso: 69.9 }],
    metas,
  )
  assert.equal(h.dias.length, 7)
  assert.equal(h.dias[1]!.calorias, 0)
  assert.equal(h.dias[2]!.calorias, 2500.4)
  assert.equal(h.dias_con_registro, 2)
  assert.equal(h.medias?.calorias, 2225.2)
  assert.equal(h.medias?.agua_ml, 1500)
  assert.equal(h.dias_en_objetivo, 1)
  assert.deepEqual(h.peso, { inicio: 70.4, fin: 69.9, cambio: -0.5 })
  assert.equal(agregarHistorial('2026-10-01', '2026-10-02', [], [], [], null).medias, null)
})

test('rangos validados: orden, máximo 93 días (historial) y 366 (CSV)', () => {
  assert.equal(historialQuery.safeParse({ desde: '2026-10-07', hasta: '2026-10-01' }).success, false)
  assert.equal(historialQuery.safeParse({ desde: '2026-01-01', hasta: '2026-06-01' }).success, false)
  assert.equal(historialQuery.safeParse({ desde: '2026-09-01', hasta: '2026-09-30' }).success, true)
  assert.equal(exportarQuery.safeParse({ desde: '2025-10-07', hasta: '2026-10-06', tipo: 'comidas' }).success, true)
  assert.equal(exportarQuery.safeParse({ desde: '2025-10-01', hasta: '2026-10-06', tipo: 'comidas' }).success, false)
  assert.equal(exportarQuery.safeParse({ desde: '2026-10-01', hasta: '2026-10-06', tipo: 'usuarios' }).success, false)
})

test('CSV: «;», coma decimal, comillas, BOM e inyección de fórmulas', () => {
  assert.equal(celdaCsv(12.5), '12,5')
  assert.equal(celdaCsv(-3), '-3')
  assert.equal(celdaCsv('Pan; tomate'), '"Pan; tomate"')
  assert.equal(celdaCsv('Dice "hola"'), '"Dice ""hola"""')
  assert.equal(celdaCsv('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`)
  assert.equal(celdaCsv('+34 600'), "'+34 600")
  assert.equal(celdaCsv('@SUM(A1)'), "'@SUM(A1)")
  assert.equal(celdaCsv(null), '')
  const csv = generarCsv(['A', 'B'], [[1, 'x']])
  assert.ok(csv.startsWith('\uFEFFA;B\r\n1;x\r\n'))
  assert.equal(nombreArchivo('comidas', '2026-10-01', '2026-10-31'), 'nutrifit-comidas-2026-10-01_2026-10-31.csv')
})

function poblar(env: any) {
  const db = env.DB.sqlite
  db.prepare("INSERT INTO usuarios (id, email, meta_calorias, meta_proteinas, meta_carbs, meta_grasas) VALUES ('u-1', 'ana@ejemplo.es', 2000, 120, 220, 60)").run()
  db.prepare("INSERT INTO usuarios (id, email) VALUES ('u-2', 'luis@ejemplo.es')").run()
  const ins = db.prepare('INSERT INTO diario_comidas (id, usuario_id, tipo_comida, descripcion, calorias, proteinas, carbohidratos, grasas, ingredientes_json, fecha) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
  ins.run('c1', 'u-1', 'desayuno', 'Tostada; aceite', 300, 8, 40, 12, JSON.stringify([{ nombre: 'Pan', gramos: 60 }]), '2026-10-01')
  ins.run('c2', 'u-1', 'comida', '=cmd', 700, 40, 60, 25, null, '2026-10-01')
  ins.run('c3', 'u-2', 'cena', 'De otro usuario', 999, 1, 1, 1, null, '2026-10-01')
  db.prepare("INSERT INTO registro_agua (usuario_id, fecha, ml) VALUES ('u-1', '2026-10-01', 1750)").run()
  db.prepare("INSERT INTO historico_peso (id, usuario_id, peso, fecha) VALUES ('p1', 'u-1', 70.5, '2026-10-02')").run()
}

test('GET /api/historial: solo datos del usuario de la sesión', async () => {
  const env = entornoTest()
  poblar(env)
  const res = await getHistorial(ctx(env, new Request('https://n/api/historial?desde=2026-10-01&hasta=2026-10-07'), { usuarioId: 'u-1', email: 'ana@ejemplo.es' }))
  const h = (await res.json()) as any
  assert.equal(h.dias.length, 7)
  assert.equal(h.dias[0].calorias, 1000)
  assert.equal(h.dias[0].num_comidas, 2)
  assert.equal(h.dias[0].agua_ml, 1750)
  assert.equal(h.dias[1].peso, 70.5)
  assert.equal(h.metas.calorias, 2000)
  const sin = await capturar(getHistorial(ctx(env, new Request('https://n/api/historial?desde=2026-10-01&hasta=2026-10-07'))))
  assert.equal(sin.status, 401)
})

test('GET /api/exportar: CSV con Content-Disposition y sin datos ajenos', async () => {
  const env = entornoTest()
  poblar(env)
  const res = await getExportar(ctx(env, new Request('https://n/api/exportar?tipo=comidas&desde=2026-10-01&hasta=2026-10-31'), { usuarioId: 'u-1', email: 'ana@ejemplo.es' }))
  assert.equal(res.headers.get('Content-Type'), 'text/csv; charset=utf-8')
  assert.equal(res.headers.get('Content-Disposition'), 'attachment; filename="nutrifit-comidas-2026-10-01_2026-10-31.csv"')
  const txt = await res.text()
  const lineas = txt.replace('\uFEFF', '').trim().split('\r\n')
  assert.equal(lineas.length, 3)
  assert.equal(lineas[1], '2026-10-01;Desayuno;"Tostada; aceite";300;8;40;12;Pan (60 g)')
  assert.ok(lineas[2]!.includes(";'=cmd;"))
  assert.ok(!txt.includes('De otro usuario'))
  const bytes = new Uint8Array(await (await getExportar(ctx(env, new Request('https://n/api/exportar?tipo=agua&desde=2026-10-01&hasta=2026-10-31'), { usuarioId: 'u-1', email: 'a' }))).arrayBuffer())
  assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf], 'UTF-8 con BOM (Excel)')
  assert.equal(new TextDecoder().decode(bytes), 'Fecha;Agua (ml)\r\n2026-10-01;1750\r\n')
})
