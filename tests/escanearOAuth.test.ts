import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ErrorIA } from '../functions/utils/ia.ts'
import { FotoIlegible } from '../functions/utils/iaParseo.ts'
import { aPlato, cascadaEscaneo, debeContinuarCascada, huellaImagen } from '../functions/utils/orquestadorVision.ts'
import { completarGoogle, destinoTrasGoogle, leerStateGoogle, prepararAutorizacion, redirectGoogle } from '../functions/utils/googleOAuth.ts'
import { onRequestGet as inicioGoogle } from '../functions/api/auth/google/index.ts'
import { firmar } from '../functions/utils/crypto.ts'
import { firmarIpCliente } from '../functions/utils/ipPasarela.ts'
import { resolverIdioma, traducir } from '../src/lib/i18n.ts'
import type { ResultadoAnalisis } from '../functions/utils/iaParseo.ts'

const plato = (): ResultadoAnalisis => ({
  input_query: '',
  display_name: 'Cruasán de mantequilla',
  nombre_plato: 'Cruasán de mantequilla',
  ingredientes: [{ nombre: 'Cruasán de mantequilla', display_name: 'Cruasán de mantequilla', gramos: 70, min_gramos: undefined, max_gramos: undefined, calorias: 280, proteinas: 5, carbohidratos: 32, grasas: 15 }],
  calorias: 280,
  proteinas: 5,
  carbohidratos: 32,
  grasas: 15,
  alternativas: [
    { nombre: 'Brioche', gramos: 80, calorias: 260, proteinas: 6, carbohidratos: 34, grasas: 11 },
    { nombre: 'Napolitana', gramos: 90, calorias: 320, proteinas: 6, carbohidratos: 36, grasas: 16 },
    { nombre: 'Cruasán de mantequilla', gramos: 70, calorias: 280, proteinas: 5, carbohidratos: 32, grasas: 15 },
  ],
})

test('el plato unificado no arrastra el proveedor y deja como máximo dos alternativas', () => {
  const u = aPlato(plato())
  assert.deepEqual(Object.keys(u).sort(), ['alimento', 'alternativas', 'calorias', 'categoria', 'descripcion', 'emoji', 'items', 'macros', 'peso_aprox_g'])
  assert.equal(u.alimento, 'Cruasán de mantequilla')
  assert.equal(u.descripcion, '')
  assert.equal(u.categoria, 'panaderia')
  assert.equal(u.peso_aprox_g, 70)
  assert.deepEqual(u.macros, { proteinas: 5, carbohidratos: 32, grasas: 15 })
  assert.deepEqual(u.alternativas, ['Brioche', 'Napolitana'])
  assert.ok(u.items!.every((i) => !('proveedor' in i)))
})

test('la cascada sigue ante 429 o timeout y se detiene si la foto no es comida', async () => {
  let workers = 0
  const ok = await cascadaEscaneo([
    async () => {
      throw new ErrorIA('Gemini HTTP 429')
    },
    async () => {
      workers += 1
      return plato()
    },
  ])
  assert.equal(ok.display_name, 'Cruasán de mantequilla')
  assert.equal(workers, 1)
  assert.equal(debeContinuarCascada(Object.assign(new Error('timeout'), { name: 'TimeoutError' })), true)

  let siguiente = 0
  const ilegible = new FotoIlegible()
  await assert.rejects(
    () =>
      cascadaEscaneo([
        async () => {
          throw ilegible
        },
        async () => {
          siguiente += 1
          return plato()
        },
      ]),
    FotoIlegible,
  )
  assert.equal(siguiente, 0)
  const definitivo = new ErrorIA('no es comida')
  definitivo.definitivo = true
  assert.equal(debeContinuarCascada(definitivo), false)
})

test('la huella de la foto cabe en la clave de catalogo_alimentos_cache', async () => {
  const clave = await huellaImagen(new Uint8Array([1, 2, 3, 4]))
  assert.match(clave, /^ia:[0-9a-f]{64}$/)
  assert.ok(clave.length <= 120)
})

test('Google firma el state, lo deja en cookie Lax y no pone el verificador en la URL', async () => {
  const env = {
    AUTH_SECRET: 's'.repeat(48),
    ENVIRONMENT: 'development',
    APP_URL: 'https://nutri.trujillomingorance.com',
    GOOGLE_CLIENT_ID: 'cliente.apps.googleusercontent.com',
    GOOGLE_CLIENT_SECRET: 'secreto',
  } as any
  const preparado = await prepararAutorizacion(env, new Request('https://nutri.trujillomingorance.com/api/auth/google'))
  assert.ok(preparado)
  const location = new URL(preparado.location)
  assert.equal(location.origin, 'https://accounts.google.com')
  assert.equal(location.searchParams.get('redirect_uri'), 'https://nutri.trujillomingorance.com/api/auth/callback/google')
  assert.equal(location.searchParams.get('client_id'), 'cliente.apps.googleusercontent.com')
  assert.equal(location.searchParams.get('code_challenge_method'), 'S256')
  assert.match(preparado.cookie, /HttpOnly/)
  assert.match(preparado.cookie, /Secure/)
  assert.match(preparado.cookie, /SameSite=Lax/)
  assert.doesNotMatch(preparado.cookie, /SameSite=Strict/)
  assert.doesNotMatch(preparado.cookie, /Domain=/i)
  assert.match(preparado.cookie, /Path=\//)
  assert.match(preparado.cookie, /Max-Age=300/)
  const state = location.searchParams.get('state')!
  assert.equal(preparado.location.includes(preparado.cookie.split(';')[0]!.split('=').slice(1).join('=')), false)
  const token = preparado.cookie.split(';')[0]!.split('=').slice(1).join('=')
  const vuelta = new Request(`https://nutri.trujillomingorance.com/api/auth/callback/google?code=1&state=${state}`, {
    headers: { Cookie: `__Host-nf_google=${token}` },
  })
  assert.ok((await leerStateGoogle(env, vuelta))?.verifier)
  const ajeno = new Request(`https://nutri.trujillomingorance.com/api/auth/callback/google?code=1&state=${state}x`, {
    headers: { Cookie: `__Host-nf_google=${token}` },
  })
  assert.equal(await leerStateGoogle(env, ajeno), null)
  const caducado = await firmar('s'.repeat(48), 'google-oauth', { n: state, v: 'v'.repeat(43), exp: 1 })
  const viejo = new Request(`https://nutri.trujillomingorance.com/api/auth/callback/google?code=1&state=${state}`, {
    headers: { Cookie: `__Host-nf_google=${caducado}` },
  })
  assert.equal(await leerStateGoogle(env, viejo), null)
})

test('redirect_uri usa el origen permitido y no un host ajeno', async () => {
  const env = {
    AUTH_SECRET: 's'.repeat(48),
    ENVIRONMENT: 'production',
    APP_URL: 'https://nutri.trujillomingorance.com',
    GOOGLE_CLIENT_ID: 'cliente.apps.googleusercontent.com',
    GOOGLE_CLIENT_SECRET: 'secreto',
  } as any
  for (const origen of ['http://localhost:8788', 'http://127.0.0.1:8788']) {
    const uri = await redirectGoogle(env, new Request(`${origen}/api/auth/google`))
    assert.equal(uri, `${origen}/api/auth/callback/google`)
    assert.equal(destinoTrasGoogle(env, new Request(`${origen}/api/auth/callback/google?code=1`)), `${origen}/?auth=error`)
  }
  const produccion = 'https://nutri.trujillomingorance.com/api/auth/callback/google'
  for (const origen of ['https://nutri.trujillomingorance.com', 'https://nutrifit.trujillomingorance.com', 'https://evil.example']) {
    assert.equal(await redirectGoogle(env, new Request(`${origen}/api/auth/google`)), produccion)
    assert.ok(destinoTrasGoogle(env, new Request(`${origen}/api/auth/callback/google?code=1`)).startsWith('https://nutri.trujillomingorance.com/?auth=error'))
  }

  const res = await inicioGoogle({
    env,
    request: new Request('http://localhost:8788/api/auth/google?formato=json'),
  } as any)
  assert.equal(res.status, 200)
  const cuerpo = (await res.json()) as { redirect_uri: string; location: string }
  assert.equal(cuerpo.redirect_uri, 'http://localhost:8788/api/auth/callback/google')
  const location = new URL(cuerpo.location)
  assert.equal(location.origin, 'https://accounts.google.com')
  assert.equal(location.pathname, '/o/oauth2/v2/auth')
  assert.equal(location.searchParams.get('redirect_uri'), cuerpo.redirect_uri)
  assert.equal(cuerpo.location.includes('secreto'), false)
})

test('una petición firmada por la pasarela sigue usando el callback de la PWA', async () => {
  const env = {
    AUTH_SECRET: 's'.repeat(48),
    ENVIRONMENT: 'production',
    APP_URL: 'https://nutri.trujillomingorance.com/',
    GOOGLE_CLIENT_ID: 'cliente.apps.googleusercontent.com',
    GOOGLE_CLIENT_SECRET: 'secreto',
  } as any
  const sig = await firmarIpCliente(env.AUTH_SECRET, '203.0.113.9')
  const req = new Request('https://nutri.trujillomingorance.com/api/auth/google', {
    headers: { 'x-nf-via': 'gateway', 'x-nf-client-sig': sig },
  })
  const uri = redirectGoogle(env, req)
  assert.equal(uri, 'https://nutri.trujillomingorance.com/api/auth/callback/google')
  assert.equal(new URL(uri).pathname, '/api/auth/callback/google')
  assert.equal(destinoTrasGoogle(env, req), 'https://nutri.trujillomingorance.com/?auth=error')
  assert.equal(redirectGoogle(env, req), redirectGoogle(env, new Request('https://api.trujillomingorance.com/nutrifit/auth/callback/google?code=1')))
})

test('el canje usa el mismo redirect_uri y registra el cuerpo si Google lo rechaza', async () => {
  const env = {
    AUTH_SECRET: 's'.repeat(48),
    ENVIRONMENT: 'production',
    APP_URL: 'https://nutri.trujillomingorance.com',
    GOOGLE_CLIENT_ID: 'cliente.apps.googleusercontent.com\n',
    GOOGLE_CLIENT_SECRET: 'secreto\n',
  } as any
  const preparado = await prepararAutorizacion(env, new Request('https://nutri.trujillomingorance.com/api/auth/google'))
  assert.ok(preparado)
  const state = new URL(preparado.location).searchParams.get('state')!
  const token = preparado.cookie.split(';')[0]!.split('=').slice(1).join('=')
  const originalFetch = globalThis.fetch
  const originalError = console.error
  const avisos: unknown[][] = []
  console.error = (...args: unknown[]) => {
    avisos.push(args)
  }
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const cuerpo = String(init?.body ?? '')
    assert.match(cuerpo, /redirect_uri=https%3A%2F%2Fnutri\.trujillomingorance\.com%2Fapi%2Fauth%2Fcallback%2Fgoogle(?:&|$)/)
    assert.equal(cuerpo.includes('%0A'), false)
    assert.equal(cuerpo.includes('secreto%0A'), false)
    return new Response('{"error":"invalid_grant","error_description":"Bad Request"}', { status: 400 })
  }) as typeof fetch
  try {
    const res = await completarGoogle(env, new Request(`https://nutri.trujillomingorance.com/api/auth/callback/google?code=abc&state=${state}`, {
      headers: { Cookie: `__Host-nf_google=${token}` },
    }))
    assert.ok(res.headers.get('location')?.startsWith('https://nutri.trujillomingorance.com/?auth=error'))
    assert.equal(avisos.some((a) => a[0] === '[Google OAuth Error]' && String(a[1]).includes('invalid_grant')), true)
    assert.equal(JSON.stringify(avisos).includes('secreto'), false)
  } finally {
    globalThis.fetch = originalFetch
    console.error = originalError
  }
})

test('el idioma sale de nutrifit_lang y, si no hay, de navigator.language', () => {
  assert.equal(resolverIdioma('ca', 'en-US'), 'ca')
  assert.equal(resolverIdioma(null, 'ca-ES'), 'ca')
  assert.equal(resolverIdioma(null, 'en-GB'), 'en')
  assert.equal(resolverIdioma(null, 'es-ES'), 'es')
  assert.equal(resolverIdioma('fr', 'pt-BR'), 'es')
  assert.equal(traducir('nav.hoy', 'en'), 'Today')
  assert.equal(traducir('nav.hoy', 'ca'), 'Avui')
  assert.equal(traducir('clave.inexistente', 'en'), 'clave.inexistente')
})

test('varias unidades: el desglose conserva la cantidad y los totales suman todas', () => {
  const u = aPlato({ nombre_plato: '2 tostadas con tortilla', display_name: '2 tostadas con tortilla', ingredientes: [
    { nombre: 'pan', display_name: '2 rebanadas de pan tostado', gramos: 80, calorias: 210, proteinas: 7, carbohidratos: 40, grasas: 2 },
    { nombre: 'tortilla', display_name: '2 porciones de tortilla de patatas', gramos: 160, calorias: 300, proteinas: 11, carbohidratos: 20, grasas: 19 },
  ], calorias: 510, proteinas: 18, carbohidratos: 60, grasas: 21 } as never)
  assert.equal(u.alimento, '2 tostadas con tortilla')
  assert.deepEqual(u.items!.map((i) => i.nombre), ['2 rebanadas de pan tostado', '2 porciones de tortilla de patatas'])
  assert.equal(u.peso_aprox_g, 240)
  assert.equal(u.items!.reduce((a, i) => a + i.calorias, 0), u.calorias)
})

test('units del modelo se convierte en cantidad visible en el título y en cada pieza', async () => {
  const { normalizarAnalisis } = await import('../functions/utils/iaParseo.ts')
  const r = normalizarAnalisis({ is_food: true, alimento: 'Tostada con tortilla', categoria: 'plato_elaborado', items: [
    { input_query: 'pan', display_name: 'Rebanada de pan tostado', grams: 80, min_grams: 60, max_grams: 100, units: 2, calories: 210, protein: 7, carbs: 40, fat: 2 },
    { input_query: 'tortilla', display_name: '2 porciones de tortilla de patatas', grams: 160, min_grams: 120, max_grams: 200, units: 2, calories: 300, protein: 11, carbs: 20, fat: 19 },
  ], total: { calories: 510, protein: 18, carbs: 60, fat: 21 } })
  assert.match(r.nombre_plato, /^2 /)
  assert.deepEqual(r.ingredientes.map((i) => i.display_name), ['2 × Rebanada de pan tostado', '2 porciones de tortilla de patatas'])
  assert.equal(r.calorias, 510)
})
