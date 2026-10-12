/** Códigos de barras de producto: EAN-13, EAN-8, UPC-A, UPC-E y GTIN-14. */

/** ¿Dígito de control GS1 correcto? */
export function digitoControlOk(codigo: string): boolean {
  if (!/^\d{8,14}$/.test(codigo)) return false
  const d = codigo.split('').map(Number)
  const control = d.pop()!
  let suma = 0
  for (let i = d.length - 1, peso = 3; i >= 0; i--, peso = peso === 3 ? 1 : 3) suma += d[i]! * peso
  return (10 - (suma % 10)) % 10 === control
}

/** UPC-E (8 cifras empezando por 0/1) → UPC-A. */
export function upceAUpca(c: string): string | null {
  if (!/^[01]\d{7}$/.test(c)) return null
  const s = c[0]!, m = c.slice(1, 7), ctrl = c[7]!
  const x = m[5]!
  const cuerpo =
    x <= '2' ? m.slice(0, 2) + x + '0000' + m.slice(2, 5)
    : x === '3' ? m.slice(0, 3) + '00000' + m.slice(3, 5)
    : x === '4' ? m.slice(0, 4) + '00000' + m[4]
    : m.slice(0, 5) + '0000' + x
  return s + cuerpo + ctrl
}

/**
 * Normaliza a la forma canónica (EAN-13 si es posible). Devuelve null si no
 * es un código válido: así un fotograma mal leído no dispara una búsqueda.
 */
export function normalizarEan(bruto: string): string | null {
  const c = bruto.replace(/\D/g, '')
  if (!c) return null
  if (c.length === 14 && c.startsWith('0')) return normalizarEan(c.slice(1))
  if (c.length === 13 || c.length === 8 || c.length === 14) return digitoControlOk(c) ? c : null
  if (c.length === 12) return digitoControlOk(c) ? '0' + c : null
  return null
}

/** Variantes a probar en los catálogos (con y sin cero inicial, UPC-E expandido). */
export function variantesEan(c: string): string[] {
  const v = new Set([c])
  if (c.length === 13 && c.startsWith('0')) v.add(c.slice(1))
  if (c.length === 12) v.add('0' + c)
  if (c.length === 8) { const a = upceAUpca(c); if (a && digitoControlOk(a)) { v.add(a); v.add('0' + a) } }
  return [...v]
}
