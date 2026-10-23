/**
 * Web Push sin dependencias (WebCrypto): VAPID (RFC 8292, JWT ES256) y cifrado
 * aes128gcm (RFC 8291). Lo usan las Pages Functions y el Worker nutrifit-cron.
 */
export interface SuscripcionPush {
  endpoint: string
  p256dh: string
  auth: string
}
export interface ClavesVapid {
  /** Clave pública sin comprimir (65 bytes) en base64url. */
  publica: string
  /** Clave privada en JWK (JSON) — se guarda como secreto VAPID_PRIVATE_JWK. */
  privadaJwk: string
  /** mailto: o https: de contacto. */
  sujeto: string
}

const te = new TextEncoder()

export function b64u(bytes: ArrayBuffer | Uint8Array): string {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let s = ''
  for (const x of b) s += String.fromCharCode(x)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
export function desdeB64u(s: string): Uint8Array {
  const p = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)
  const bin = atob(p)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
function concat(...partes: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(partes.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of partes) { out.set(p, o); o += p.length }
  return out
}

async function hkdf(sal: Uint8Array, ikm: Uint8Array, info: Uint8Array, largo: number): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: sal, info }, k, largo * 8))
}

/** JWT VAPID para el origen del endpoint (válido 12 h). */
export async function jwtVapid(endpoint: string, v: ClavesVapid, ahora = Math.floor(Date.now() / 1000)): Promise<string> {
  const aud = new URL(endpoint).origin
  const cab = b64u(te.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const cuerpo = b64u(te.encode(JSON.stringify({ aud, exp: ahora + 12 * 3600, sub: v.sujeto })))
  const clave = await crypto.subtle.importKey('jwk', JSON.parse(v.privadaJwk), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const firma = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, clave, te.encode(`${cab}.${cuerpo}`))
  return `${cab}.${cuerpo}.${b64u(firma)}`
}

/** Cifra el payload según RFC 8291 (un único registro aes128gcm). */
export async function cifrarPayload(sub: SuscripcionPush, payload: Uint8Array, sal = crypto.getRandomValues(new Uint8Array(16))): Promise<Uint8Array> {
  const uaPub = desdeB64u(sub.p256dh)
  const authSecret = desdeB64u(sub.auth)
  const local = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair
  const asPub = new Uint8Array((await crypto.subtle.exportKey('raw', local.publicKey)) as ArrayBuffer)
  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey } as unknown as SubtleCryptoDeriveKeyAlgorithm, local.privateKey, 256))
  const ikm = await hkdf(authSecret, ecdh, concat(te.encode('WebPush: info\0'), uaPub, asPub), 32)
  const cek = await hkdf(sal, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(sal, ikm, te.encode('Content-Encoding: nonce\0'), 12)
  const k = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, k, concat(payload, new Uint8Array([2]))))
  const rs = new Uint8Array([0, 0, 0x10, 0]) // 4096
  return concat(sal, rs, new Uint8Array([asPub.length]), asPub, cifrado)
}

export interface Aviso {
  titulo: string
  cuerpo: string
  url?: string
  etiqueta?: string
  /** Botones de la notificación (Chrome/Android y relojes muestran 2; iOS ninguno). */
  acciones?: { accion: string; titulo: string }[]
  /** Volver a sonar/vibrar aunque ya haya una con la misma etiqueta. */
  renotificar?: boolean
  vibrar?: number[]
  /** Datos para el service worker (franja, fecha, token de acción). */
  datos?: Record<string, string>
}

/** Envía un aviso. Devuelve el status HTTP (404/410 → suscripción caducada). */
export async function enviarPush(sub: SuscripcionPush, aviso: Aviso, v: ClavesVapid, ttl = 3600): Promise<number> {
  const cuerpo = await cifrarPayload(sub, te.encode(JSON.stringify(aviso)))
  const jwt = await jwtVapid(sub.endpoint, v)
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      authorization: `vapid t=${jwt}, k=${v.publica}`,
      'content-encoding': 'aes128gcm',
      'content-type': 'application/octet-stream',
      ttl: String(ttl),
      urgency: 'normal',
      ...(aviso.etiqueta ? { topic: aviso.etiqueta.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) } : {}),
    },
    body: cuerpo,
  })
  return res.status
}

export function vapidDeEnv(env: { VAPID_PUBLIC_KEY?: string; VAPID_PRIVATE_JWK?: string; VAPID_SUBJECT?: string }): ClavesVapid | null {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_JWK) return null
  return { publica: env.VAPID_PUBLIC_KEY, privadaJwk: env.VAPID_PRIVATE_JWK, sujeto: env.VAPID_SUBJECT || 'mailto:soporte@trujillomingorance.com' }
}
