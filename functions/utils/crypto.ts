/**
 * Utilidades criptográficas sobre WebCrypto (Workers y Node ≥ 20).
 * HMAC-SHA256, SHA-256, comparación en tiempo constante y base64url.
 */
const enc = new TextEncoder()
const dec = new TextDecoder()

export function base64urlEncode(data: Uint8Array | string): string {
  const bytes = typeof data === 'string' ? enc.encode(data) : data
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function base64urlDecode(s: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new Error('base64url inválido')
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export const base64urlDecodeText = (s: string) => dec.decode(base64urlDecode(s))

/**
 * Comparación en tiempo constante (no corta en el primer byte distinto).
 * La longitud no se considera secreta (las firmas HMAC miden siempre 32 bytes).
 */
export function timingSafeEqual(a: Uint8Array | string, b: Uint8Array | string): boolean {
  const x = typeof a === 'string' ? enc.encode(a) : a
  const y = typeof b === 'string' ? enc.encode(b) : b
  if (x.length !== y.length) return false
  let diff = 0
  for (let i = 0; i < x.length; i++) diff |= x[i]! ^ y[i]!
  return diff === 0
}

const claves = new Map<string, Promise<CryptoKey>>()

/**
 * Clave HMAC derivada del secreto maestro y un propósito ("sesion", "magic"…),
 * para que un token de un tipo nunca sea válido como otro.
 */
async function claveHmac(secreto: string, proposito: string): Promise<CryptoKey> {
  const id = `${proposito}:${secreto}`
  let k = claves.get(id)
  if (!k) {
    k = (async () => {
      const maestra = await crypto.subtle.importKey('raw', enc.encode(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
      const derivada = await crypto.subtle.sign('HMAC', maestra, enc.encode(`nutrifit:v1:${proposito}`))
      return crypto.subtle.importKey('raw', derivada, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    })()
    claves.set(id, k)
  }
  return k
}

export async function hmacSha256(secreto: string, proposito: string, mensaje: string): Promise<Uint8Array> {
  const key = await claveHmac(secreto, proposito)
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(mensaje)))
}

export async function sha256Hex(texto: string): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(texto)))
  return Array.from(h, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function bytesAleatorios(n = 32): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n))
}

/**
 * Token firmado compacto:  base64url(JSON payload) "." base64url(HMAC).
 */
export async function firmar(secreto: string, proposito: string, payload: object): Promise<string> {
  const cuerpo = base64urlEncode(JSON.stringify(payload))
  const firma = base64urlEncode(await hmacSha256(secreto, proposito, cuerpo))
  return `${cuerpo}.${firma}`
}

/** Verifica firma (tiempo constante) y devuelve el payload, o null. No mira la caducidad. */
export async function verificarFirma<T>(secreto: string, proposito: string, token: string): Promise<T | null> {
  if (typeof token !== 'string' || token.length > 2048) return null
  const partes = token.split('.')
  if (partes.length !== 2 || !partes[0] || !partes[1]) return null
  try {
    const esperada = await hmacSha256(secreto, proposito, partes[0])
    if (!timingSafeEqual(esperada, base64urlDecode(partes[1]))) return null
    return JSON.parse(base64urlDecodeText(partes[0])) as T
  } catch {
    return null
  }
}
