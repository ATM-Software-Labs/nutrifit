import { test } from 'node:test'
import assert from 'node:assert/strict'
import { entornoTest, ctx, postJson, capturar } from './d1Sqlite.ts'
import { crearCookieSesion, crearTokenApp, resolverSesion, verificarTokenApp } from '../functions/utils/session.ts'
import { exigirIdentidad } from '../functions/utils/identidad.ts'
import { desvincularStrava } from '../functions/utils/integraciones.ts'
import { escaparHtml, sanitizarTextoLibre } from '../functions/utils/sanitizar.ts'
import { comidaGuardarSchema, entrenamientoSchema, socialSchema, subirImagenSchema } from '../functions/utils/schemas.ts'
import { validarImagenSubida } from '../functions/utils/archivos.ts'
import { HttpError } from '../functions/utils/response.ts'
import { onRequestPost as postEntreno, onRequestGet as getEntreno } from '../functions/api/entrenamientos/index.ts'
import { onRequestPost as postSocial } from '../functions/api/usuarios/social.ts'
import { onRequestGet as getPublico } from '../functions/api/usuarios/publico.ts'
import { onRequestGet as getSugerencias } from '../functions/api/usuarios/sugerencias.ts'
import { onRequestGet as getSuggestions } from '../functions/api/users/suggestions.ts'
import { onRequestGet as getFriendsSuggestions } from '../functions/api/friends/suggestions.ts'
import { onRequestPost as postFollow } from '../functions/api/friends/follow.ts'
import { fotoGoogle } from '../functions/utils/googleOAuth.ts'
import { onRequestPost as postAmistad, onRequestGet as getAmistad } from '../functions/api/amistades/index.ts'
import { onRequestPost as postAvatar } from '../functions/api/usuarios/avatar.ts'
import { onRequestPost as postFoto } from '../functions/api/comidas/foto.ts'
import { onRequestGet as getArchivo } from '../functions/api/archivos/[id].ts'
import type { Sesion } from '../functions/utils/env.ts'

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0x11, 0xd9])

async function entrar(env: ReturnType<typeof entornoTest>, id: string, email: string): Promise<Sesion> {
  env.DB.sqlite.prepare('INSERT INTO usuarios (id, email) VALUES (?, ?)').run(id, email)
  const cookie = await crearCookieSesion(env, id, email)
  const resuelta = await resolverSesion(
    env,
    new Request('https://nutri.trujillomingorance.com/api/auth/yo', { headers: { cookie: cookie.split(';')[0]! } }),
  )
  assert.ok(resuelta.sesion?.sidHash)
  return resuelta.sesion
}

function conSesion(
  env: ReturnType<typeof entornoTest>,
  request: Request,
  sesion: Sesion | null,
  params: Record<string, string> = {},
) {
  const c = ctx(env, request, null)
  c.data.sesion = sesion
  c.params = params
  return c
}

test('la migración añade el perfil social sin impedir el diario histórico', () => {
  const db = entornoTest().DB.sqlite
  const cols = db.prepare('PRAGMA table_info(usuarios)').all().map((c: { name: string }) => String(c.name))
  for (const col of ['username', 'bio', 'avatar_url', 'banner_url', 'es_publico', 'meta_agua_base_ml']) {
    assert.ok(cols.includes(col), col)
  }
  assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE name = 'amistades'").get())
  assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE name = 'comidas_frecuentes'").get())
  const entreno = db.prepare('PRAGMA table_info(entrenamientos)').all().map((c: { name: string }) => String(c.name))
  for (const col of ['tipo', 'duracion_min', 'intensidad', 'calorias', 'fecha', 'minutos']) assert.ok(entreno.includes(col), col)

  db.prepare("INSERT INTO usuarios (id, email) VALUES ('u', 'a@b.es')").run()
  db.prepare("INSERT INTO diario_comidas (id, usuario_id, tipo_comida, descripcion, fecha) VALUES ('c', 'u', 'comida', 'Arroz', '2026-10-09')").run()
  db.prepare("INSERT INTO registro_agua (usuario_id, fecha, ml) VALUES ('u', '2026-10-09', 250)").run()
  db.prepare("INSERT INTO historico_peso (id, usuario_id, peso, fecha) VALUES ('p', 'u', 70.5, '2026-10-09')").run()
  const comida = db.prepare('SELECT descripcion FROM diario_comidas WHERE id = ?').get('c') as { descripcion: string }
  assert.equal(comida.descripcion, 'Arroz')
  const agua = db.prepare('SELECT meta_agua_base_ml, es_publico FROM usuarios WHERE id = ?').get('u') as { meta_agua_base_ml: number; es_publico: number }
  assert.equal(agua.meta_agua_base_ml, 2500)
  assert.equal(agua.es_publico, 1)
})

test('username, bio y usuario_id ajeno', () => {
  assert.equal(socialSchema.safeParse({ username: 'ana_1' }).success, true)
  assert.equal(socialSchema.safeParse({ username: 'ab' }).success, false)
  assert.equal(socialSchema.safeParse({ username: 'hola mundo' }).success, false)
  assert.equal(socialSchema.safeParse({ username: '<script>' }).success, false)
  assert.equal(socialSchema.safeParse({ username: 'ana', usuario_id: 'otro' }).success, false)
  assert.equal(subirImagenSchema.safeParse({ imagen: 'a'.repeat(16), usuario_id: 'otro' }).success, false)
  const bio = socialSchema.parse({ bio: '  Hola <script>alert(1)</script> & queso  ' })
  assert.equal(bio.bio, 'Hola alert(1) & queso')
  assert.equal(escaparHtml(bio.bio ?? ''), 'Hola alert(1) &amp; queso')
  assert.equal(sanitizarTextoLibre('<img src=x onerror=alert(1)>'), '')
  assert.equal(entrenamientoSchema.safeParse({ tipo: 'fuerza', nombre: 'Press', minutos: 30, calorias: 100, usuario_id: 'x' }).success, false)
  assert.equal(entrenamientoSchema.safeParse({ tipo: 'fuerza', nombre: 'Press', minutos: 30, calorias: 100, origen: 'strava' }).success, false)
  assert.equal(comidaGuardarSchema.safeParse({ tipo_comida: 'cena', descripcion: 'Tortilla', calorias: 300, proteinas: 20, carbohidratos: 10, grasas: 20, fecha: '2026-10-09', imagen_url: 'http://evil.test/a.jpg' }).success, false)
})

test('la imagen se acepta solo si los bytes y el MIME coinciden y cabe en 2 MB', () => {
  assert.equal(validarImagenSubida(JPEG, 'image/jpeg').mime, 'image/jpeg')
  assert.throws(() => validarImagenSubida(JPEG, 'image/png'), (e: unknown) => e instanceof HttpError && e.status === 415)
  assert.throws(() => validarImagenSubida(Uint8Array.from([0x47, 0x49, 0x46, 0x38]), 'image/gif'), (e: unknown) => e instanceof HttpError && e.status === 415)
  assert.throws(() => validarImagenSubida(new Uint8Array(1_900_001), 'image/jpeg'), (e: unknown) => e instanceof HttpError && e.status === 413)
})

test('el entreno se guarda con el usuario de la sesión', async () => {
  const env = entornoTest()
  const ana = await entrar(env, 'ana', 'ana@b.es')
  const luis = await entrar(env, 'luis', 'luis@b.es')
  const malo = await capturar(postEntreno(conSesion(env, postJson('/api/entrenamientos', { tipo: 'cardio', nombre: 'Correr', minutos: 20, calorias: 150, usuario_id: 'ana' }), null)))
  assert.equal(malo.status, 401)

  const rechazado = await capturar(
    postEntreno(conSesion(env, postJson('/api/entrenamientos', { tipo: 'cardio', nombre: '<b>Correr</b>', minutos: 20, calorias: 150, usuario_id: 'luis' }), ana)),
  )
  assert.equal(rechazado.status, 400)

  const res = await postEntreno(conSesion(env, postJson('/api/entrenamientos', { tipo: 'cardio', nombre: '<b>Correr</b>', minutos: 20, calorias: 150 }), ana))
  assert.equal(res.status, 201)
  const fila = env.DB.sqlite.prepare('SELECT usuario_id, nombre, minutos, duracion_min, tipo FROM entrenamientos').get() as {
    usuario_id: string
    nombre: string
    minutos: number
    duracion_min: number
    tipo: string
  }
  assert.equal(fila.usuario_id, 'ana')
  assert.equal(fila.nombre, 'Correr')
  assert.equal(fila.minutos, 20)
  assert.equal(fila.duracion_min, 20)
  assert.equal(fila.tipo, 'cardio')

  const deLuis = await getEntreno(conSesion(env, new Request('https://nutri.trujillomingorance.com/api/entrenamientos'), luis))
  const cuerpo = (await deLuis.json()) as { entrenamientos: unknown[] }
  assert.equal(cuerpo.entrenamientos.length, 0)
})

test('la identidad se contrasta con sesiones_web y con el token de la app', async () => {
  const env = entornoTest()
  const ana = await entrar(env, 'ana', 'ana@b.es')
  assert.equal((await exigirIdentidad(env, ana)).usuarioId, 'ana')
  const falso = { ...ana, sidHash: '0'.repeat(64) }
  const e = await capturar(exigirIdentidad(env, falso))
  assert.equal(e.status, 401)
  const { token } = await crearTokenApp(env, 'ana', 'ana@b.es')
  const bearer = await verificarTokenApp(env, token)
  assert.equal((await exigirIdentidad(env, bearer)).usuarioId, 'ana')
})

test('amistad y perfil público no aceptan un usuario_id ni enseñan cuentas privadas', async () => {
  const env = entornoTest()
  const ana = await entrar(env, 'ana', 'ana@b.es')
  const luis = await entrar(env, 'luis', 'luis@b.es')
  env.DB.sqlite.prepare("UPDATE usuarios SET username = 'ana_fit', es_publico = 1 WHERE id = 'ana'").run()
  env.DB.sqlite.prepare("UPDATE usuarios SET username = 'luis_fit', es_publico = 0 WHERE id = 'luis'").run()

  const colado = await capturar(postAmistad(conSesion(env, postJson('/api/amistades', { username: 'luis_fit', usuario_id: 'ana' }), ana)))
  assert.equal(colado.status, 400)
  const self = await capturar(postAmistad(conSesion(env, postJson('/api/amistades', { username: 'ana_fit' }), ana)))
  assert.equal(self.status, 400)

  const alta = await postAmistad(conSesion(env, postJson('/api/amistades', { username: 'luis_fit' }), ana))
  assert.equal(alta.status, 201)
  const solicitante = env.DB.sqlite.prepare('SELECT solicitante_id, receptor_id, estado FROM amistades').get() as {
    solicitante_id: string
    receptor_id: string
    estado: string
  }
  assert.equal(solicitante.solicitante_id, 'ana')
  assert.equal(solicitante.receptor_id, 'luis')
  assert.equal(solicitante.estado, 'pendiente')

  const lista = await getAmistad(conSesion(env, new Request('https://nutri.trujillomingorance.com/api/amistades'), luis))
  const cuerpo = (await lista.json()) as { amistades: { username: string | null; direccion: string }[] }
  assert.equal(cuerpo.amistades[0]?.username, 'ana_fit')
  assert.equal(cuerpo.amistades[0]?.direccion, 'recibida')
  assert.equal(JSON.stringify(cuerpo).includes('ana@b.es'), false)

  const privado = await getPublico(conSesion(env, new Request('https://nutri.trujillomingorance.com/api/usuarios/publico?username=luis_fit'), ana))
  assert.equal(privado.status, 404)
  const publico = await getPublico(conSesion(env, new Request('https://nutri.trujillomingorance.com/api/usuarios/publico?username=ANA_fit'), luis))
  assert.equal(publico.status, 200)
  const perfil = (await publico.json()) as { perfil: { username: string; email?: string } }
  assert.equal(perfil.perfil.username, 'ana_fit')
  assert.equal('email' in perfil.perfil, false)
})

test('la comunidad pública sale de 5 en 5 sin término de búsqueda', async () => {
  const env = entornoTest()
  const yo = await entrar(env, 'yo', 'yo@b.es')
  await entrar(env, 'privado', 'privado@b.es')
  env.DB.sqlite.prepare("UPDATE usuarios SET username = 'oculto', es_publico = 0, actualizado_en = '2026-10-09T00:00:09' WHERE id = 'privado'").run()
  env.DB.sqlite.prepare("UPDATE usuarios SET username = 'yo_fit', es_publico = 1 WHERE id = 'yo'").run()
  for (let i = 1; i <= 6; i++) {
    const id = `u${i}`
    await entrar(env, id, `u${i}@b.es`)
    env.DB.sqlite.prepare('UPDATE usuarios SET username = ?, es_publico = 1, nombre = ?, actualizado_en = ? WHERE id = ?').run(`fit_${i}`, `Nombre ${i}`, `2026-10-09T00:00:0${i}`, id)
  }
  const uno = await getPublico(conSesion(env, new Request('https://nutri.trujillomingorance.com/api/usuarios/publico'), yo))
  assert.equal(uno.status, 200)
  const cuerpo = (await uno.json()) as { comunidad: { username: string }[]; pagina: number; hay_mas: boolean }
  assert.equal(cuerpo.pagina, 1)
  assert.equal(cuerpo.comunidad.length, 5)
  assert.equal(cuerpo.hay_mas, true)
  const nombres = cuerpo.comunidad.map((c) => c.username)
  assert.equal(nombres.includes('yo_fit'), false)
  assert.equal(nombres.includes('oculto'), false)
  assert.equal(JSON.stringify(cuerpo).includes('yo@b.es'), false)
  assert.equal(JSON.stringify(cuerpo).includes('"email"'), false)
  const dos = await getPublico(conSesion(env, new Request('https://nutri.trujillomingorance.com/api/usuarios/publico?pagina=2'), yo))
  assert.equal(dos.status, 200)
  const pagina2 = (await dos.json()) as { comunidad: { username: string }[]; hay_mas: boolean }
  assert.equal(pagina2.comunidad.length, 1)
  assert.equal(pagina2.hay_mas, false)
  assert.equal(nombres.includes(pagina2.comunidad[0]!.username), false)
})

test('las sugerencias excluyen al usuario y a sus amigos y devuelven []', async () => {
  const env = entornoTest()
  const yo = await entrar(env, 'yo', 'yo@b.es')
  await entrar(env, 'amigo', 'amigo@b.es')
  await entrar(env, 'pendiente', 'pendiente@b.es')
  await entrar(env, 'nuevo', 'nuevo@b.es')
  await entrar(env, 'privado', 'privado@b.es')
  env.DB.sqlite.prepare("UPDATE usuarios SET username = 'yo_fit', es_publico = 1, creado_en = '2026-10-01' WHERE id = 'yo'").run()
  env.DB.sqlite.prepare("UPDATE usuarios SET username = 'amigo_fit', nombre = 'Amigo', es_publico = 1, creado_en = '2026-10-02' WHERE id = 'amigo'").run()
  env.DB.sqlite.prepare("UPDATE usuarios SET username = 'espera_fit', es_publico = 1, creado_en = '2026-10-03' WHERE id = 'pendiente'").run()
  env.DB.sqlite.prepare("UPDATE usuarios SET username = 'nuevo_fit', nombre = 'Nueva <b>persona</b>', bio = 'Hola', avatar_url = 'https://lh3.googleusercontent.com/a/foto', es_publico = 1, creado_en = '2026-10-09' WHERE id = 'nuevo'").run()
  env.DB.sqlite.prepare("UPDATE usuarios SET username = 'oculto', es_publico = 0, creado_en = '2026-10-09' WHERE id = 'privado'").run()
  env.DB.sqlite.prepare("INSERT INTO amistades (id, solicitante_id, receptor_id, estado) VALUES ('am-1', 'yo', 'amigo', 'aceptada')").run()
  env.DB.sqlite.prepare("INSERT INTO amistades (id, solicitante_id, receptor_id, estado) VALUES ('am-2', 'pendiente', 'yo', 'pendiente')").run()

  const res = await getSugerencias(conSesion(env, new Request('https://nutri.trujillomingorance.com/api/usuarios/sugerencias'), yo))
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('content-type'), 'application/json; charset=utf-8')
  const lista = (await res.json()) as { username: string; nombre: string | null; avatar_url: string | null; bio: string | null; id?: string; email?: string }[]
  assert.ok(Array.isArray(lista))
  assert.deepEqual(lista.map((f) => f.username), ['nuevo_fit', 'espera_fit'])
  assert.equal(lista[0]?.nombre, 'Nueva persona')
  assert.equal(lista[0]?.bio, 'Hola')
  assert.equal(lista[0]?.avatar_url, 'https://lh3.googleusercontent.com/a/foto')
  assert.equal('id' in (lista[0] ?? {}), false)
  assert.equal(JSON.stringify(lista).includes('yo@b.es'), false)
  assert.equal(JSON.stringify(lista).includes('email'), false)

  const alias = await getSuggestions(conSesion(env, new Request('https://nutri.trujillomingorance.com/api/users/suggestions'), yo))
  assert.equal(alias.status, 200)
  const otra = (await alias.json()) as { username: string }[]
  assert.deepEqual(otra.map((f) => f.username), ['nuevo_fit', 'espera_fit'])

  assert.equal(fotoGoogle('https://lh3.googleusercontent.com/a/abc'), 'https://lh3.googleusercontent.com/a/abc')
  assert.equal(fotoGoogle('http://lh3.googleusercontent.com/a/abc'), null)
  assert.equal(fotoGoogle('https://evil.example/a'), null)
  assert.equal(fotoGoogle(''), null)
})

test('GET /api/friends/suggestions devuelve success y follow inserta en amistades', async () => {
  const env = entornoTest()
  const yoId = '11111111-1111-4111-8111-111111111111'
  const amigoId = '22222222-2222-4222-8222-222222222222'
  const nuevoId = '33333333-3333-4333-8333-333333333333'
  const yo = await entrar(env, yoId, 'yo@b.es')
  await entrar(env, amigoId, 'amigo@b.es')
  await entrar(env, nuevoId, 'nuevo@b.es')
  env.DB.sqlite.prepare("UPDATE usuarios SET username = 'yo_fit', es_publico = 1, creado_en = '2026-10-01' WHERE id = ?").run(yoId)
  env.DB.sqlite.prepare("UPDATE usuarios SET username = 'amigo_fit', nombre = 'Amigo', es_publico = 1, creado_en = '2026-10-02' WHERE id = ?").run(amigoId)
  env.DB.sqlite.prepare("UPDATE usuarios SET username = 'nuevo_fit', nombre = 'Nueva', bio = 'Hola', es_publico = 1, creado_en = '2026-10-09' WHERE id = ?").run(nuevoId)
  env.DB.sqlite.prepare("INSERT INTO amistades (id, solicitante_id, receptor_id, estado) VALUES ('am-f', ?, ?, 'aceptada')").run(yoId, amigoId)

  const res = await getFriendsSuggestions(conSesion(env, new Request('https://nutri.trujillomingorance.com/api/friends/suggestions'), yo))
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('content-type'), 'application/json; charset=utf-8')
  const cuerpo = (await res.json()) as { success: boolean; suggestions: { id: string; username: string; name: string | null; email?: string }[] }
  assert.equal(cuerpo.success, true)
  assert.deepEqual(cuerpo.suggestions.map((s) => s.username), ['nuevo_fit'])
  assert.equal(cuerpo.suggestions[0]?.id, nuevoId)
  assert.equal(cuerpo.suggestions[0]?.name, 'Nueva')
  assert.equal(JSON.stringify(cuerpo).includes('email'), false)
  assert.equal(JSON.stringify(cuerpo).includes('amigo@b.es'), false)

  const colado = await capturar(postFollow(conSesion(env, postJson('/api/friends/follow', { targetUserId: nuevoId, usuario_id: yoId }), yo)))
  assert.equal(colado.status, 400)
  const alta = await postFollow(conSesion(env, postJson('/api/friends/follow', { targetUserId: nuevoId }), yo))
  assert.equal(alta.status, 201)
  const seguido = (await alta.json()) as { success: boolean; status: string }
  assert.equal(seguido.success, true)
  assert.equal(seguido.status, 'pending')
  const fila = env.DB.sqlite.prepare('SELECT solicitante_id, receptor_id, estado FROM amistades WHERE receptor_id = ?').get(nuevoId) as {
    solicitante_id: string
    receptor_id: string
    estado: string
  }
  assert.equal(fila.solicitante_id, yoId)
  assert.equal(fila.receptor_id, nuevoId)
  assert.equal(fila.estado, 'pendiente')

  const otra = await getFriendsSuggestions(conSesion(env, new Request('https://nutri.trujillomingorance.com/api/friends/suggestions'), yo))
  const despues = (await otra.json()) as { suggestions: unknown[] }
  assert.deepEqual(despues.suggestions, [])
})

test('sin otros perfiles públicos las sugerencias son []', async () => {
  const env = entornoTest()
  const yo = await entrar(env, 'solo', 'solo@b.es')
  env.DB.sqlite.prepare("UPDATE usuarios SET username = 'solo_fit', es_publico = 1 WHERE id = 'solo'").run()
  const res = await getSugerencias(conSesion(env, new Request('https://nutri.trujillomingorance.com/api/usuarios/sugerencias'), yo))
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('content-type'), 'application/json; charset=utf-8')
  assert.deepEqual(await res.json(), [])
})

test('el username repetido no pisa a otra cuenta', async () => {
  const env = entornoTest()
  const ana = await entrar(env, 'ana', 'ana@b.es')
  const luis = await entrar(env, 'luis', 'luis@b.es')
  const uno = await postSocial(conSesion(env, postJson('/api/usuarios/social', { username: 'ana_fit', bio: 'Hola <i>tú</i>' }), ana))
  assert.equal(uno.status, 200)
  const dos = await postSocial(conSesion(env, postJson('/api/usuarios/social', { username: 'ANA_fit' }), luis))
  assert.equal(dos.status, 409)
  const bio = env.DB.sqlite.prepare('SELECT bio FROM usuarios WHERE id = ?').get('ana') as { bio: string }
  assert.equal(bio.bio, 'Hola tú')
})

test('avatar y foto de plato: MIME, dueño y UUID', async () => {
  const env = entornoTest()
  const ana = await entrar(env, 'ana', 'ana@b.es')
  const luis = await entrar(env, 'luis', 'luis@b.es')
  const svg = new FormData()
  svg.append('imagen', new File([JPEG], 'foto.svg', { type: 'image/svg+xml' }))
  const malo = await capturar(
    postAvatar(conSesion(env, new Request('https://nutri.trujillomingorance.com/api/usuarios/avatar', { method: 'POST', body: svg }), ana)),
  )
  assert.equal(malo.status, 415)

  const fd = new FormData()
  fd.append('imagen', new File([JPEG], '../../etc/passwd.jpg', { type: 'image/jpeg' }))
  const res = await postAvatar(conSesion(env, new Request('https://nutri.trujillomingorance.com/api/usuarios/avatar', { method: 'POST', body: fd }), ana))
  assert.equal(res.status, 200)
  const cuerpo = (await res.json()) as { avatar_url: string }
  assert.match(cuerpo.avatar_url, /^\/api\/archivos\/[0-9a-f-]{36}$/i)
  const id = cuerpo.avatar_url.split('/').pop()!
  const guardado = env.DB.sqlite.prepare('SELECT usuario_id, mime FROM archivos_usuario WHERE id = ?').get(id) as { usuario_id: string; mime: string }
  assert.equal(guardado.usuario_id, 'ana')
  assert.equal(guardado.mime, 'image/jpeg')

  const fotoFd = new FormData()
  fotoFd.append('imagen', new File([JPEG], 'plato.jpg', { type: 'image/jpeg' }))
  const foto = await postFoto(conSesion(env, new Request('https://nutri.trujillomingorance.com/api/comidas/foto', { method: 'POST', body: fotoFd }), ana))
  assert.equal(foto.status, 201)
  const fotoJson = (await foto.json()) as { id: string }
  const ajena = await getArchivo(conSesion(env, new Request(`https://nutri.trujillomingorance.com/api/archivos/${fotoJson.id}`), luis, { id: fotoJson.id }))
  assert.equal(ajena.status, 404)
  const propia = await getArchivo(conSesion(env, new Request(`https://nutri.trujillomingorance.com/api/archivos/${id}`), null, { id }))
  assert.equal(propia.status, 200)
  assert.equal(propia.headers.get('content-type'), 'image/jpeg')
})

test('Strava se borra y el resto de integraciones conserva el token', async () => {
  const env = entornoTest()
  env.DB.sqlite.exec(`
    CREATE TABLE integraciones_apps (
      id TEXT PRIMARY KEY,
      usuario_id TEXT,
      proveedor TEXT,
      access_token TEXT,
      refresh_token TEXT
    );
    INSERT INTO integraciones_apps VALUES ('1', 'ana', 'strava', 'tok-strava', 'ref-strava');
    INSERT INTO integraciones_apps VALUES ('2', 'ana', 'garmin', 'tok-garmin', 'ref-garmin');
  `)
  await desvincularStrava(env)
  const filas = env.DB.sqlite.prepare('SELECT proveedor, access_token FROM integraciones_apps ORDER BY proveedor').all() as { proveedor: string; access_token: string }[]
  assert.deepEqual(filas.map((f) => ({ proveedor: f.proveedor, access_token: f.access_token })), [{ proveedor: 'garmin', access_token: 'tok-garmin' }])
  await desvincularStrava(entornoTest())
})
