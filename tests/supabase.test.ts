/** Supabase como base secundaria: catálogo, copia diaria, afinado de la IA y vigilancia. */
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { d1Sqlite } from './d1Sqlite.ts'
import { filaCatalogoAlimento, nombrePlatoCatalogo, guardarEnCatalogo, catalogoPorCodigo } from '../functions/utils/supabase.ts'
import { copiarD1ASupabase, enLotes, filaParaCopia, TABLAS_COPIA, TABLAS_SIN_COPIA } from '../functions/utils/copiaSupabase.ts'
import { afinarConCatalogo, elegir, reiniciarCircuitoCatalogo, type Coincidencia } from '../functions/utils/afinarCatalogo.ts'
import { pareceEnPausa, transicion, urlPanel, vigilarSupabase } from '../functions/utils/saludSupabase.ts'
import type { ResultadoAnalisis } from '../functions/utils/iaParseo.ts'

const ENV = { SUPABASE_URL: 'https://pjyseojkjfcpyjrrrlzm.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'clave-de-prueba' }
type Llamada = { url: string; method: string; body: any; headers: Headers }
let llamadas: Llamada[] = []
const original = globalThis.fetch
function simular(responder: (l: Llamada) => Response | Promise<Response>) {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const l = { url: String(input), method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : null, headers: new Headers(init?.headers) }
    llamadas.push(l)
    return responder(l)
  }) as typeof fetch
}
beforeEach(() => {
  llamadas = []
  globalThis.fetch = original
  reiniciarCircuitoCatalogo()
})

test('catálogo: normaliza, descarta lo inválido y no lleva datos del usuario', () => {
  const f = filaCatalogoAlimento({ codigo: '8412700012955', nombre: ' Cacaolat High Protein ', marca: 'Cacaolat', unidad: 'ml', calorias: 56, proteinas: 9.1, carbohidratos: 4, grasas: 0.5, envase: 275, fuente: 'openfoodfacts' })!
  assert.equal(f.clave, 'ean:8412700012955')
  assert.equal(f.unidad, 'ml')
  assert.equal(f.nombre, 'Cacaolat High Protein')
  assert.ok(!('usuario_id' in f))
  assert.equal(filaCatalogoAlimento({ nombre: 'Producto sin nombre', calorias: 10, fuente: 'usda' }), null)
  assert.equal(filaCatalogoAlimento({ nombre: 'X', calorias: 2000, fuente: 'usda' }), null)
  assert.equal(filaCatalogoAlimento({ nombre: 'Pan', marca: 'Genérico', calorias: 250, fuente: 'usuario' })!.marca, null)
})

test('catálogo de platos: descarta nombres que pueden identificar a alguien', () => {
  assert.equal(nombrePlatoCatalogo('Tortilla de patatas')?.nombre_norm, 'tortilla de patatas')
  assert.equal(nombrePlatoCatalogo('Cena con Marta'), null)
  assert.equal(nombrePlatoCatalogo('La lasaña de mi abuela'), null)
  assert.equal(nombrePlatoCatalogo('pedido a ana@correo.es'), null)
  assert.equal(nombrePlatoCatalogo('llamar 612345678'), null)
})

test('upsert: lo público actualiza y lo del usuario no pisa', async () => {
  simular(() => new Response(null, { status: 201 }))
  await guardarEnCatalogo(ENV, [
    { codigo: '12345678', nombre: 'A', calorias: 100, fuente: 'openfoodfacts' },
    { codigo: '87654321', nombre: 'B', calorias: 100, fuente: 'usuario' },
  ])
  const prefer = llamadas.map((l) => l.headers.get('prefer')).sort()
  assert.deepEqual(prefer, ['resolution=ignore-duplicates,return=minimal', 'resolution=merge-duplicates,return=minimal'])
  assert.ok(llamadas.every((l) => l.headers.get('apikey') === 'clave-de-prueba' && l.url.includes('/rest/v1/catalogo_alimentos?on_conflict=clave')))
})

test('búsqueda por código: Supabase caído → null sin lanzar', async () => {
  simular(() => { throw new Error('ECONNREFUSED') })
  assert.equal(await catalogoPorCodigo(ENV, ['8412700012955']), null)
  assert.equal(await catalogoPorCodigo({}, ['8412700012955']), null)
})

test('copia: todas las tablas de D1 están copiadas o excluidas a propósito', () => {
  const tablas = new Set<string>()
  for (const f of readdirSync('migrations').filter((f) => f.endsWith('.sql'))) {
    for (const m of readFileSync(`migrations/${f}`, 'utf8').matchAll(/CREATE TABLE(?: IF NOT EXISTS)?\s+(\w+)/gi)) tablas.add(m[1])
  }
  tablas.delete('estado_servicios')
  const cubiertas = new Set([...TABLAS_COPIA.map((t) => t.tabla), ...TABLAS_SIN_COPIA])
  for (const t of tablas) assert.ok(cubiertas.has(t), `la tabla ${t} no está en TABLAS_COPIA ni en TABLAS_SIN_COPIA`)
})

test('copia: sin tokens OAuth, BLOB en base64, pk compuesta y lotes', () => {
  const integ = TABLAS_COPIA.find((t) => t.tabla === 'integraciones_apps')!
  const f = filaParaCopia(integ, { id: 'i1', token_acceso: 'secreto', token_refresco: 'x', proveedor: 'strava' }, 'T')
  assert.deepEqual(f.fila, { id: 'i1', proveedor: 'strava' })
  const agua = TABLAS_COPIA.find((t) => t.tabla === 'registro_agua')!
  assert.equal(filaParaCopia(agua, { usuario_id: 'u', fecha: '2026-10-20', ml: 500 }, 'T').pk, 'u|2026-10-20')
  const arch = TABLAS_COPIA.find((t) => t.tabla === 'archivos_usuario')!
  assert.deepEqual(filaParaCopia(arch, { id: 'a', contenido: new Uint8Array([1, 2, 3]) }, 'T').fila.contenido, { base64: 'AQID' })
  const muchas = Array.from({ length: 1200 }, (_, i) => ({ tabla: 't', pk: String(i), fila: {}, sincronizado_en: 'T' }))
  assert.deepEqual(enLotes(muchas).map((l) => l.length), [500, 500, 200])
})

test('copia: sube todo, borra lo que ya no está y devuelve recuentos', async () => {
  const db = d1Sqlite()
  db.sqlite.exec("INSERT INTO usuarios (id, email) VALUES ('u1', 'a@b.es'), ('u2', 'c@d.es')")
  db.sqlite.exec("INSERT INTO diario_comidas (id, usuario_id, tipo_comida, descripcion, fecha) VALUES ('c1', 'u1', 'cena', 'Tortilla', '2026-10-20')")
  db.sqlite.exec("INSERT INTO sesiones_web (sid_hash, familia_hash, usuario_id, email, creado_en, expira_en) VALUES ('s', 'f', 'u1', 'a@b.es', 1, 2)")
  const subidas: any[] = []
  simular((l) => {
    if (l.url.includes('/bk_filas?on_conflict')) { subidas.push(...l.body); return new Response(null, { status: 201 }) }
    if (l.method === 'DELETE') { assert.match(l.url, /sincronizado_en=lt\./); return new Response(null, { status: 204, headers: { 'content-range': '*/3' } }) }
    if (l.url.endsWith('/rpc/bk_resumen')) return Response.json([{ tabla: 'usuarios', filas: 2 }, { tabla: 'diario_comidas', filas: 1 }])
    return new Response(null, { status: 201 })
  })
  const r = await copiarD1ASupabase({ ...ENV, DB: db as never })
  assert.equal(r.ok, true)
  assert.equal(r.d1.usuarios, 2)
  assert.equal(r.d1.diario_comidas, 1)
  assert.equal(r.subidas, 3)
  assert.equal(r.borradas, 3)
  assert.ok(!subidas.some((s) => s.tabla === 'sesiones_web'))
  assert.deepEqual(r.supabase, { usuarios: 2, diario_comidas: 1 })
})

test('copia: si falla una subida no se borra nada', async () => {
  const db = d1Sqlite()
  db.sqlite.exec("INSERT INTO usuarios (id, email) VALUES ('u1', 'a@b.es')")
  simular((l) => (l.url.includes('/bk_filas?on_conflict') ? new Response('boom', { status: 500 }) : new Response('[]', { status: 200 })))
  const r = await copiarD1ASupabase({ ...ENV, DB: db as never })
  assert.equal(r.ok, false)
  assert.ok(!llamadas.some((l) => l.method === 'DELETE'))
})

const coin = (texto: string, tipo: 'comida' | 'alimento', nombre: string, similitud: number, kcal: number, p = 0, c = 0, g = 0): Coincidencia =>
  ({ texto, tipo, clave: nombre, nombre, similitud, kcal_100: kcal, proteinas_100: p, carbohidratos_100: c, grasas_100: g, porcion_g: null })

test('elegir: umbrales y nunca un alimento crudo/seco para algo cocinado', () => {
  assert.equal(elegir('arroz blanco', [coin('arroz blanco', 'alimento', 'Arroz blanco crudo', 0.9, 355)]), null)
  assert.equal(elegir('arroz blanco', [coin('arroz blanco', 'comida', 'Arroz blanco', 1, 141)])?.nombre, 'Arroz blanco')
  assert.equal(elegir('Tortilla de patatas', [coin('Tortilla de patatas', 'alimento', 'Tortitas de patata', 0.68, 268)]), null)
  assert.equal(elegir('aguacate', [coin('aguacate', 'alimento', 'Aguacate', 1, 160), coin('aguacate', 'comida', 'Tostada con aguacate', 0.43, 227)])?.nombre, 'Aguacate')
})

const analisis = (): ResultadoAnalisis => ({
  input_query: '', display_name: 'Tostadas con tortilla', nombre_plato: 'Tostadas con tortilla',
  ingredientes: [
    { nombre: 'pan tostado', gramos: 60, calorias: 150, proteinas: 5, carbohidratos: 30, grasas: 1 },
    { nombre: 'tortilla de patatas', gramos: 100, calorias: 230, proteinas: 6, carbohidratos: 15, grasas: 16 },
    { nombre: 'salsa misteriosa', gramos: 20, calorias: 40, proteinas: 0, carbohidratos: 2, grasas: 3 },
  ] as never,
  calorias: 420, proteinas: 11, carbohidratos: 47, grasas: 20,
})

test('afinar: usa macros del catálogo escalados y deja la IA donde no hay coincidencia', async () => {
  simular(() => Response.json([
    coin('pan tostado', 'alimento', 'Pan tostado', 1, 390, 11, 74, 5),
    coin('tortilla de patatas', 'comida', 'Tortilla de patatas', 1, 141, 5, 9.9, 8.7),
  ]))
  const a = await afinarConCatalogo(ENV, analisis())
  assert.equal(a.catalogo, 'ok')
  assert.equal(a.afinados, 2)
  assert.equal(a.resultado.ingredientes[0].calorias, 234) // 60 g × 390/100
  assert.equal(a.resultado.ingredientes[1].calorias, 141)
  assert.equal(a.resultado.ingredientes[2].calorias, 40) // sin coincidencia: IA
  assert.equal(a.resultado.calorias, 415)
})

test('afinar: Supabase caído → análisis intacto y precisión reducida; el circuito evita esperar', async () => {
  simular(() => { throw new Error('timeout') })
  const a = await afinarConCatalogo(ENV, analisis())
  assert.equal(a.catalogo, 'no_disponible')
  assert.equal(a.resultado.calorias, 420)
  const n = llamadas.length
  const b = await afinarConCatalogo(ENV, analisis())
  assert.equal(b.catalogo, 'no_disponible')
  assert.equal(llamadas.length, n) // circuito abierto: ni lo intenta
  assert.equal((await afinarConCatalogo({}, analisis())).catalogo, 'sin_config')
})

test('vigilancia: alerta a los 30 min, una sola vez, y aviso de recuperación', () => {
  const t0 = 1_800_000_000
  let e = transicion(null, { estado: 'caido', error: 'Supabase 503' }, t0, ENV.SUPABASE_URL)
  assert.equal(e.alerta, null)
  e = transicion(e.fila, { estado: 'caido' }, t0 + 15 * 60, ENV.SUPABASE_URL)
  assert.equal(e.alerta, null)
  e = transicion(e.fila, { estado: 'caido' }, t0 + 31 * 60, ENV.SUPABASE_URL)
  assert.equal(e.alerta?.tipo, 'caida')
  assert.match(e.alerta!.cuerpo, /31 minutos/)
  e = transicion(e.fila, { estado: 'caido' }, t0 + 46 * 60, ENV.SUPABASE_URL)
  assert.equal(e.alerta, null)
  e = transicion(e.fila, { estado: 'ok' }, t0 + 60 * 60, ENV.SUPABASE_URL)
  assert.equal(e.alerta?.tipo, 'recuperado')
  assert.equal(e.fila.caido_desde, null)
})

test('vigilancia: pausado avisa al momento con el enlace para restaurarlo', () => {
  assert.ok(pareceEnPausa('Supabase 540: Project paused'))
  const e = transicion(null, { estado: 'pausado', error: 'Supabase 540' }, 1_800_000_000, ENV.SUPABASE_URL)
  assert.equal(e.alerta?.titulo, 'Supabase está en pausa')
  assert.equal(e.alerta?.url, 'https://supabase.com/dashboard/project/pjyseojkjfcpyjrrrlzm')
  assert.equal(urlPanel(ENV.SUPABASE_URL), 'https://supabase.com/dashboard/project/pjyseojkjfcpyjrrrlzm')
})

test('vigilancia: latido real (lectura + escritura) y estado guardado en D1', async () => {
  const db = d1Sqlite()
  simular((l) => {
    assert.ok(l.url.endsWith('/rest/v1/rpc/nf_latido'))
    return Response.json([{ visto_en: '2026-10-20T10:00:00Z', n: 7, alimentos: 307143, comidas: 593, filas_copia: 140 }])
  })
  const r = await vigilarSupabase({ ...ENV, DB: db as never }, async () => true, (titulo, cuerpo, url) => ({ asunto: titulo, html: url, texto: cuerpo }))
  assert.equal(r.estado, 'ok')
  assert.equal(r.latido?.n, 7)
  const f = db.sqlite.prepare("SELECT estado FROM estado_servicios WHERE servicio = 'supabase'").get() as { estado: string }
  assert.equal(f.estado, 'ok')
})
