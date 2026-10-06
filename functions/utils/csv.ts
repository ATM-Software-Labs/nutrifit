/**
 * CSV para Excel/LibreOffice en español (módulo PURO):
 *   · separador «;» y coma decimal (lo que espera Excel con configuración es-ES);
 *   · UTF-8 con BOM para que los acentos se vean bien;
 *   · protección contra inyección de fórmulas (=, +, -, @, tab, CR al inicio → ').
 */
export const SEPARADOR = ';'
export const BOM = '\uFEFF'

export function celdaCsv(v: unknown): string {
  if (v === null || v === undefined) return ''
  let s: string
  if (typeof v === 'number') s = Number.isFinite(v) ? String(Math.round(v * 100) / 100).replace('.', ',') : ''
  else s = String(v)
  if (typeof v !== 'number' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[";\r\n]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s
}

export function generarCsv(cabeceras: string[], filas: unknown[][]): string {
  const lineas = [cabeceras, ...filas].map((f) => f.map(celdaCsv).join(SEPARADOR))
  return BOM + lineas.join('\r\n') + '\r\n'
}

/** Nombre de archivo seguro para Content-Disposition. */
export const nombreArchivo = (tipo: string, desde: string, hasta: string) => `nutrifit-${tipo}-${desde}_${hasta}.csv`.replace(/[^a-z0-9._-]/gi, '')
