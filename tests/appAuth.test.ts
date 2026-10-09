/**
 * App Android: tokens Bearer (firma, tipo, caducidad, revocación) y CORS del
 * middleware (preflight solo para el WebView de Capacitor, Bearer sin Origin).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { firmar } from '../functions/utils/crypto.ts'
import { crearTokenApp, leerSesion, revocarTokenApp, verificarTokenApp, crearCookieSesion } from '../functions/utils/session.ts'
import { onRequest } from '../functions/_middleware.ts'

/** D1 mínimo en memoria: solo lo que usan tokens_app y la limpieza. */
function d1Falso() {
  const tokens = new Map<string, { usuario_id: string; expira_en: number; revocado_en: number | null }>()
  const sesiones = new Map<string, Record<string, unknown>>()
  const db = {
    tokens,
    prepare(sql: string) {
      let args: unknown[] = []
      const st = {
        bind(...a: unknown[]) {
          args = a
          return st
        },
        async run() {
          if (sql.startsWith('INSERT INTO tokens_app')) tokens.set(args[0] as string, { usuario_id: args[1] as string, expira_en: args[3] as number, revocado_en: null })
          if (sql.startsWith('UPDATE tokens_app')) {
            const t = tokens.get(args[1] as string)
            if (t && t.revocado_en === null) t.revocado_en = args[0] as number
          }
          if (sql.includes('INSERT INTO sesiones_web')) {
            sesiones.set(args[0] as string, {
              usuario_id: args[2],
              email: args[3],
              expira_en: args[5],
              revocado_en: null,
              reemplazado_por: null,
              gracia_hasta: null,
              familia_hash: args[1],
              visto_en: null,
            })
          }
          return { success: true, meta: { changes: 1 } }
        },
        async first() {
          if (sql.includes('FROM tokens_app')) {
            const t = tokens.get(args[0] as string)
            return t && t.usuario_id === args[1] && t.revocado_en === null && t.expira_en > (args[2] as number) ? { ok: 1 } : null
          }
          if (sql.includes('FROM sesiones_web')) return sesiones.get(args[0] as string) ?? null
          return null
        },
      }
      return st
    },
    async batch() {
      return []
    },
  }
  return db
}

const SECRETO = 's'.repeat(48)
const entorno = () => ({ DB: d1Falso(), AUTH_SECRET: SECRETO, ENVIRONMENT: 'development', ALLOWED_ORIGINS: 'https://nutri.trujillomingorance.com' }) as any
const conBearer = (t: string) => new Request('https://nutri.trujillomingorance.com/api/auth/yo', { headers: { Authorization: `Bearer ${t}` } })

test('Bearer válido → sesión "bearer"; revocado → null', async () => {
  const env = entorno()
  const { token, exp } = await crearTokenApp(env, 'u1', 'a@b.es')
  assert.ok(exp - Date.now() / 1000 > 59 * 86400, 'dura ~60 días')
  const s = await leerSesion(env, conBearer(token))
  assert.equal(s?.usuarioId, 'u1')
  assert.equal(s?.via, 'bearer')
  await revocarTokenApp(env, s!.jtiHash!)
  assert.equal(await leerSesion(env, conBearer(token)), null)
})

test('Bearer manipulado, de otro tipo, caducado o mal formado → null', async () => {
  const env = entorno()
  const { token } = await crearTokenApp(env, 'u1', 'a@b.es')
  const [cuerpo, firma] = token.split('.')
  assert.equal(await verificarTokenApp(env, `${cuerpo}.${firma!.slice(0, -2)}xx`), null)
  // Una cookie de sesión (propósito "sesion") no vale como Bearer
  const cookie = (await crearCookieSesion(env, 'u1', 'a@b.es')).split(';')[0]!.split('=')[1]!
  assert.equal(await leerSesion(env, conBearer(cookie)), null)
  // Firmado con el propósito correcto pero caducado
  const viejo = await firmar(SECRETO, 'app', { sub: 'u1', em: 'a@b.es', iat: 1, exp: 2, v: 1, jti: 'x', typ: 'app' })
  assert.equal(await verificarTokenApp(env, viejo), null)
  // Firmado bien pero nunca registrado en D1 (p. ej. secreto filtrado sin acceso a BD)
  const huerfano = await firmar(SECRETO, 'app', { sub: 'u1', em: 'a@b.es', iat: 1, exp: 9999999999, v: 1, jti: 'nuevo', typ: 'app' })
  assert.equal(await verificarTokenApp(env, huerfano), null)
  // Cabecera mal formada: no cae a la cookie
  const r = new Request('https://x/api/auth/yo', { headers: { Authorization: 'Basic abc', Cookie: `__Host-nf_session=${cookie}` } })
  assert.equal(await leerSesion(env, r), null)
})

function ctx(request: Request, env = entorno()) {
  let llegó = false
  return {
    c: { request, env, data: {}, waitUntil() {}, next: async () => ((llegó = true), new Response('{"ok":true}', { headers: { 'content-type': 'application/json' } })) } as any,
    llegó: () => llegó,
  }
}

test('CORS: preflight solo para el WebView de la app', async () => {
  for (const origin of ['https://localhost', 'capacitor://localhost']) {
    const res = await onRequest(ctx(new Request('https://nutri.trujillomingorance.com/api/comidas/guardar', { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type' } })).c)
    assert.equal(res.status, 204)
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), origin)
    assert.match(res.headers.get('Access-Control-Allow-Headers')!, /Authorization/)
    assert.match(res.headers.get('Access-Control-Allow-Headers')!, /CF-Turnstile-Token/)
    assert.equal(res.headers.get('Access-Control-Allow-Credentials'), null)
    assert.equal(res.headers.get('X-Content-Type-Options'), 'nosniff')
    assert.equal(res.headers.get('X-Frame-Options'), 'DENY')
    assert.equal(res.headers.get('Permissions-Policy'), 'camera=(self), microphone=(), geolocation=(), payment=()')
    assert.equal(res.headers.get('Strict-Transport-Security'), 'max-age=31536000; includeSubDomains; preload')
    assert.equal(res.headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin')
    assert.match(res.headers.get('Content-Security-Policy') ?? '', /default-src 'none'/)
    assert.match(res.headers.get('Content-Security-Policy') ?? '', /frame-ancestors 'none'/)
  }
  const envExtra = entorno()
  envExtra.ALLOWED_ORIGINS = 'https://preview.nutrifit.test'
  const permitido = await onRequest(
    ctx(new Request('https://nutri.trujillomingorance.com/api/comidas/guardar', { method: 'OPTIONS', headers: { Origin: 'https://preview.nutrifit.test' } }), envExtra).c,
  )
  assert.equal(permitido.status, 204)
  assert.equal(permitido.headers.get('Access-Control-Allow-Origin'), 'https://preview.nutrifit.test')
  assert.equal(permitido.headers.get('Access-Control-Allow-Credentials'), null)
  const mismo = await onRequest(ctx(new Request('https://nutri.trujillomingorance.com/api/comidas/guardar', { method: 'OPTIONS', headers: { Origin: 'https://nutri.trujillomingorance.com' } })).c)
  assert.equal(mismo.status, 403)
  assert.equal(mismo.headers.get('Access-Control-Allow-Origin'), null)
  const malo = await onRequest(ctx(new Request('https://nutri.trujillomingorance.com/api/comidas/guardar', { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } })).c)
  assert.equal(malo.status, 403)
  assert.equal(malo.headers.get('Access-Control-Allow-Origin'), null)
})

test('Escrituras: Bearer omite Origin; origen ajeno sin Bearer → 403; app + cookie → 403', async () => {
  const env = entorno()
  const { token } = await crearTokenApp(env, 'u1', 'a@b.es')
  const post = (h: Record<string, string>) =>
    new Request('https://nutri.trujillomingorance.com/api/agua', { method: 'POST', headers: { 'content-type': 'application/json', ...h }, body: '{"fecha":"2026-10-06","ml":250}' })

  const a = ctx(post({ Authorization: `Bearer ${token}`, Origin: 'https://localhost' }), env)
  const ra = await onRequest(a.c)
  assert.ok(a.llegó() && ra.status === 200)
  assert.equal(ra.headers.get('Access-Control-Allow-Origin'), 'https://localhost')

  const b = ctx(post({ Authorization: `Bearer ${token}` }), env) // sin Origin (cliente nativo)
  assert.equal((await onRequest(b.c)).status, 200)

  const c = ctx(post({ Origin: 'https://evil.example' }), env)
  assert.equal((await onRequest(c.c)).status, 403)
  assert.ok(!c.llegó())

  const cookie = (await crearCookieSesion(env, 'u1', 'a@b.es')).split(';')[0]!
  const d = ctx(post({ Origin: 'https://localhost', Cookie: cookie }), env)
  assert.equal((await onRequest(d.c)).status, 403)

  const e = ctx(post({ Origin: 'https://nutri.trujillomingorance.com', Cookie: cookie }), env)
  const re = await onRequest(e.c)
  assert.equal(re.status, 200)
  assert.equal(re.headers.get('Access-Control-Allow-Origin'), null, 'la web no recibe cabeceras CORS')
})
