/**
 * Quita EXIF, XMP, IPTC y comentarios antes de construir el prompt.
 * Los píxeles se quedan. Si el contenedor no se puede recorrer, null:
 * no se manda al modelo un archivo que no hemos podido limpiar.
 */

const PNG_FIRMA = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const PNG_TEXTO = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME', 'iCCP'])
const WEBP_EXIF = 0x08
const WEBP_XMP = 0x04

function unir(partes: Uint8Array[]): Uint8Array {
  let n = 0
  for (const p of partes) n += p.byteLength
  const out = new Uint8Array(n)
  let o = 0
  for (const p of partes) {
    out.set(p, o)
    o += p.byteLength
  }
  return out
}

function ascii(b: Uint8Array, i: number, n: number): string {
  let s = ''
  for (let k = 0; k < n; k++) s += String.fromCharCode(b[i + k]!)
  return s
}

function quitarJpeg(bytes: Uint8Array): Uint8Array | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null
  const out: number[] = [0xff, 0xd8]
  let i = 2
  let quito = false
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) return null
    while (i < bytes.length && bytes[i] === 0xff) i++
    if (i >= bytes.length) return null
    const marker = bytes[i]!
    i++
    if (marker === 0xd9) {
      out.push(0xff, 0xd9)
      return quito ? Uint8Array.from(out) : bytes
    }
    if (marker === 0xda) {
      out.push(0xff, 0xda)
      for (let j = i; j < bytes.length; j++) out.push(bytes[j]!)
      return quito ? Uint8Array.from(out) : bytes
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      out.push(0xff, marker)
      continue
    }
    if (i + 1 >= bytes.length) return null
    const len = (bytes[i]! << 8) | bytes[i + 1]!
    if (len < 2 || i + len > bytes.length) return null
    const drop = marker === 0xfe || (marker >= 0xe0 && marker <= 0xef)
    if (drop) quito = true
    else {
      out.push(0xff, marker)
      for (let j = 0; j < len; j++) out.push(bytes[i + j]!)
    }
    i += len
  }
  return null
}

function quitarPng(bytes: Uint8Array): Uint8Array | null {
  if (bytes.length < 8) return null
  for (let i = 0; i < 8; i++) if (bytes[i] !== PNG_FIRMA[i]) return null
  const partes: Uint8Array[] = [bytes.subarray(0, 8)]
  let i = 8
  let iend = false
  let quito = false
  while (i + 8 <= bytes.length) {
    const len = ((bytes[i]! << 24) | (bytes[i + 1]! << 16) | (bytes[i + 2]! << 8) | bytes[i + 3]!) >>> 0
    if (i + 12 + len > bytes.length) return null
    const tipo = ascii(bytes, i + 4, 4)
    const fin = i + 12 + len
    if (PNG_TEXTO.has(tipo)) quito = true
    else partes.push(bytes.subarray(i, fin))
    i = fin
    if (tipo === 'IEND') {
      iend = true
      break
    }
  }
  if (!iend) return null
  return quito ? unir(partes) : bytes
}

function escribirU32le(b: Uint8Array, i: number, n: number) {
  b[i] = n & 255
  b[i + 1] = (n >>> 8) & 255
  b[i + 2] = (n >>> 16) & 255
  b[i + 3] = (n >>> 24) & 255
}

function quitarWebp(bytes: Uint8Array): Uint8Array | null {
  if (bytes.length < 12 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP') return null
  const chunks: Uint8Array[] = []
  let i = 12
  let quitoExif = false
  let quitoXmp = false
  while (i + 8 <= bytes.length) {
    const tipo = ascii(bytes, i, 4)
    const len = (bytes[i + 4]! | (bytes[i + 5]! << 8) | (bytes[i + 6]! << 16) | (bytes[i + 7]! << 24)) >>> 0
    const padded = len + (len & 1)
    if (i + 8 + padded > bytes.length) return null
    const fin = i + 8 + padded
    if (tipo === 'EXIF') quitoExif = true
    else if (tipo === 'XMP ') quitoXmp = true
    else chunks.push(bytes.subarray(i, fin))
    i = fin
  }
  if (!quitoExif && !quitoXmp) return bytes
  if (chunks.length === 0) return null
  const limpios = chunks.map((c) => {
    const copia = new Uint8Array(c)
    if (ascii(copia, 0, 4) === 'VP8X' && copia.length >= 9) {
      if (quitoExif) copia[8] = copia[8]! & ~WEBP_EXIF
      if (quitoXmp) copia[8] = copia[8]! & ~WEBP_XMP
    }
    return copia
  })
  const cuerpo = unir(limpios)
  const out = new Uint8Array(12 + cuerpo.byteLength)
  out.set(bytes.subarray(0, 12), 0)
  out.set(asciiBytes('WEBP'), 8)
  escribirU32le(out, 4, out.byteLength - 8)
  out.set(cuerpo, 12)
  return out
}

function asciiBytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

export function quitarMetadatosImagen(bytes: Uint8Array, mime: 'image/jpeg' | 'image/png' | 'image/webp'): Uint8Array | null {
  if (mime === 'image/jpeg') return quitarJpeg(bytes)
  if (mime === 'image/png') return quitarPng(bytes)
  return quitarWebp(bytes)
}
