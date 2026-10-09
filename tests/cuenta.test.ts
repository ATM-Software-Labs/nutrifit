import { test } from 'node:test'
import assert from 'node:assert/strict'
import { capturar, ctx, entornoTest, postJson } from './d1Sqlite.ts'
import { HttpError } from '../functions/utils/response.ts'
import { onRequestGet as getVolcado } from '../functions/api/usuario/exportar-datos.ts'
import { onRequestPost as postBorrar } from '../functions/api/usuario/eliminar-cuenta.ts'

function sembrar(env: ReturnType<typeof entornoTest>) {
  const db = env.DB.sqlite
  db.prepare('INSERT INTO usuarios (id, email, nombre, peso_kg) VALUES (?, ?, ?, ?)').run('u-1', 'ana@ejemplo.es', 'Ana', 62)
  db.prepare('INSERT INTO usuarios (id, email, nombre) VALUES (?, ?, ?)').run('u-2', 'otro@ejemplo.es', 'Otro')
  db.prepare(
    `INSERT INTO diario_comidas (id, usuario_id, tipo_comida, descripcion, calorias, proteinas, carbohidratos, grasas, ingredientes_json, fecha)
     VALUES ('c1', 'u-1', 'comida', 'Arroz', 200, 4, 40, 1, '[{"nombre":"Arroz"}]', '2026-10-09')`,
  ).run()
  db.prepare(
    `INSERT INTO diario_comidas (id, usuario_id, tipo_comida, descripcion, fecha) VALUES ('c2', 'u-2', 'cena', 'Secreto ajeno', '2026-10-09')`,
  ).run()
  db.prepare("INSERT INTO historico_peso (id, usuario_id, peso, fecha) VALUES ('p1', 'u-1', 62.5, '2026-10-09')").run()
  db.prepare("INSERT INTO registro_agua (usuario_id, fecha, ml) VALUES ('u-1', '2026-10-09', 800)").run()
  db.prepare(
    "INSERT INTO entrenamientos (id, usuario_id, tipo, nombre, minutos, calorias, origen, fecha) VALUES ('e1', 'u-1', 'fuerza', 'Press', 30, 195, 'manual', '2026-10-09')",
  ).run()
  db.prepare("INSERT INTO amistades (id, solicitante_id, receptor_id, estado) VALUES ('a1', 'u-1', 'u-2', 'aceptada')").run()
  db.prepare("INSERT INTO comidas_frecuentes (id, usuario_id, nombre) VALUES ('f1', 'u-1', 'Tortilla')").run()
  db.prepare("INSERT INTO codigos_login (id, email, codigo_hash, expira_en) VALUES ('cod', 'ana@ejemplo.es', 'hmac', 9999999999)").run()
  db.prepare("INSERT INTO codigos_login (id, email, codigo_hash, expira_en) VALUES ('cod2', 'otro@ejemplo.es', 'hmac', 9999999999)").run()
  db.prepare("INSERT INTO magic_tokens (jti_hash, email, expira_en, creado_en) VALUES ('j1', 'ana@ejemplo.es', 9999999999, 1)").run()
  db.prepare("INSERT INTO sesiones_web (sid_hash, familia_hash, usuario_id, email, expira_en, creado_en) VALUES ('sid', 'fam', 'u-1', 'ana@ejemplo.es', 9999999999, 1)").run()
  db.prepare("INSERT INTO tokens_app (jti_hash, usuario_id, expira_en, creado_en) VALUES ('jti', 'u-1', 9999999999, 1)").run()
  db.prepare("INSERT INTO rate_limits (clave, ventana_inicio, contador) VALUES ('portabilidad:u:u-1', 1, 1)").run()
  db.prepare("INSERT INTO rate_limits (clave, ventana_inicio, contador) VALUES ('portabilidad:u:u-2', 1, 1)").run()
}

const sesion = { usuarioId: 'u-1', email: 'ana@ejemplo.es' }

test('el volcado incluye solo los registros de la sesión', async () => {
  const env = entornoTest()
  sembrar(env)
  const res = await getVolcado(ctx(env, new Request('https://nutri.trujillomingorance.com/api/usuario/exportar-datos'), sesion))
  assert.equal(res.status, 200)
  assert.match(res.headers.get('content-type') ?? '', /application\/json/)
  assert.match(res.headers.get('content-disposition') ?? '', /nutrifit-datos\.json/)
  const cuerpo = await res.json() as {
    perfil: { email: string; nombre: string }
    diario_comidas: { descripcion: string; ingredientes: { nombre: string }[] }[]
    historico_peso: { peso: number }[]
    registro_agua: { ml: number }[]
    entrenamientos: { nombre: string }[]
  }
  assert.equal(cuerpo.perfil.email, 'ana@ejemplo.es')
  assert.equal(cuerpo.perfil.nombre, 'Ana')
  assert.deepEqual(cuerpo.diario_comidas.map((c) => c.descripcion), ['Arroz'])
  assert.equal(cuerpo.diario_comidas[0]!.ingredientes[0]!.nombre, 'Arroz')
  assert.equal(cuerpo.historico_peso[0]!.peso, 62.5)
  assert.equal(cuerpo.registro_agua[0]!.ml, 800)
  assert.equal(cuerpo.entrenamientos[0]!.nombre, 'Press')
  assert.equal(JSON.stringify(cuerpo).includes('Secreto ajeno'), false)
})

test('eliminar la cuenta exige confirmación y no toca a otra persona', async () => {
  const env = entornoTest()
  sembrar(env)
  const sinConfirmar = await capturar(postBorrar(ctx(env, postJson('/api/usuario/eliminar-cuenta', {}), sesion)))
  assert.ok(sinConfirmar instanceof HttpError)
  assert.equal(sinConfirmar.status, 400)
  assert.equal((env.DB.sqlite.prepare('SELECT email FROM usuarios WHERE id = ?').get('u-1') as { email: string }).email, 'ana@ejemplo.es')

  const res = await postBorrar(ctx(env, postJson('/api/usuario/eliminar-cuenta', { confirmar: 'ELIMINAR' }), sesion))
  assert.equal(res.status, 200)
  assert.match(res.headers.get('set-cookie') ?? '', /__Host-nf_session=;/)
  const db = env.DB.sqlite
  assert.equal(db.prepare('SELECT id FROM usuarios WHERE id = ?').get('u-1'), undefined)
  assert.equal((db.prepare('SELECT email FROM usuarios WHERE id = ?').get('u-2') as { email: string }).email, 'otro@ejemplo.es')
  assert.equal(db.prepare('SELECT id FROM diario_comidas WHERE usuario_id = ?').get('u-1'), undefined)
  assert.equal((db.prepare('SELECT descripcion FROM diario_comidas WHERE id = ?').get('c2') as { descripcion: string }).descripcion, 'Secreto ajeno')
  assert.equal(db.prepare('SELECT id FROM historico_peso WHERE usuario_id = ?').get('u-1'), undefined)
  assert.equal(db.prepare('SELECT usuario_id FROM registro_agua WHERE usuario_id = ?').get('u-1'), undefined)
  assert.equal(db.prepare('SELECT id FROM entrenamientos WHERE usuario_id = ?').get('u-1'), undefined)
  assert.equal(db.prepare('SELECT id FROM amistades WHERE id = ?').get('a1'), undefined)
  assert.equal(db.prepare('SELECT id FROM comidas_frecuentes WHERE usuario_id = ?').get('u-1'), undefined)
  assert.equal(db.prepare('SELECT id FROM codigos_login WHERE email = ?').get('ana@ejemplo.es'), undefined)
  assert.equal((db.prepare('SELECT id FROM codigos_login WHERE email = ?').get('otro@ejemplo.es') as { id: string }).id, 'cod2')
  assert.equal(db.prepare('SELECT jti_hash FROM magic_tokens WHERE email = ?').get('ana@ejemplo.es'), undefined)
  assert.equal(db.prepare('SELECT sid_hash FROM sesiones_web WHERE usuario_id = ?').get('u-1'), undefined)
  assert.equal(db.prepare('SELECT jti_hash FROM tokens_app WHERE usuario_id = ?').get('u-1'), undefined)
  assert.equal(db.prepare('SELECT clave FROM rate_limits WHERE clave = ?').get('portabilidad:u:u-1'), undefined)
  assert.equal((db.prepare('SELECT clave FROM rate_limits WHERE clave = ?').get('portabilidad:u:u-2') as { clave: string }).clave, 'portabilidad:u:u-2')
})

test('sin sesión no se exporta ni se borra', async () => {
  const env = entornoTest()
  const exp = await capturar(getVolcado(ctx(env, new Request('https://nutri.trujillomingorance.com/api/usuario/exportar-datos'), null)))
  const del = await capturar(postBorrar(ctx(env, postJson('/api/usuario/eliminar-cuenta', { confirmar: 'ELIMINAR' }), null)))
  assert.ok(exp instanceof HttpError && exp.status === 401)
  assert.ok(del instanceof HttpError && del.status === 401)
})
