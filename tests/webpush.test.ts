import test from 'node:test'
import assert from 'node:assert/strict'
import { b64u, cifrarPayload, desdeB64u, jwtVapid } from '../functions/utils/webpush.ts'

// Descifra como haría el navegador (RFC 8291) para comprobar el cifrado de extremo a extremo.
async function descifrar(cuerpo: Uint8Array, uaPriv: CryptoKey, uaPub: Uint8Array, auth: Uint8Array): Promise<string> {
  const sal = cuerpo.slice(0, 16)
  const idlen = cuerpo[20]!
  const asPub = cuerpo.slice(21, 21 + idlen)
  const datos = cuerpo.slice(21 + idlen)
  const te = new TextEncoder()
  const hk = async (s: Uint8Array, ikm: Uint8Array, info: Uint8Array, n: number) =>
    new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: s, info }, await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']), n * 8))
  const asKey = await crypto.subtle.importKey('raw', asPub, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey } as any, uaPriv, 256))
  const info = new Uint8Array([...te.encode('WebPush: info\0'), ...uaPub, ...asPub])
  const ikm = await hk(auth, ecdh, info, 32)
  const cek = await hk(sal, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hk(sal, ikm, te.encode('Content-Encoding: nonce\0'), 12)
  const plano = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']), datos))
  assert.equal(plano[plano.length - 1], 2)
  return new TextDecoder().decode(plano.slice(0, -1))
}

test('cifrado aes128gcm se descifra con la clave del navegador', async () => {
  const ua = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair
  const uaPub = new Uint8Array((await crypto.subtle.exportKey('raw', ua.publicKey)) as ArrayBuffer)
  const auth = crypto.getRandomValues(new Uint8Array(16))
  const c = await cifrarPayload({ endpoint: 'https://push.example/x', p256dh: b64u(uaPub), auth: b64u(auth) }, new TextEncoder().encode('{"titulo":"Hola"}'))
  assert.equal(await descifrar(c, ua.privateKey, uaPub, auth), '{"titulo":"Hola"}')
})

test('JWT VAPID firmado y verificable', async () => {
  const k = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair
  const jwk = JSON.stringify(await crypto.subtle.exportKey('jwk', k.privateKey))
  const pub = b64u((await crypto.subtle.exportKey('raw', k.publicKey)) as ArrayBuffer)
  const jwt = await jwtVapid('https://fcm.googleapis.com/fcm/send/abc', { publica: pub, privadaJwk: jwk, sujeto: 'mailto:a@b.c' }, 1000)
  const [h, b, f] = jwt.split('.')
  assert.equal(JSON.parse(new TextDecoder().decode(desdeB64u(b!))).aud, 'https://fcm.googleapis.com')
  const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, k.publicKey, desdeB64u(f!), new TextEncoder().encode(`${h}.${b}`))
  assert.ok(ok)
})
