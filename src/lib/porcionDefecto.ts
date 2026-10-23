/** Porción por defecto (g/ml) cuando el alimento no trae ración ni hay una cantidad recordada. */
const CLAVE = 'nf:porcionDefecto'
export function porcionDefecto(): number {
  try {
    const n = Number(localStorage.getItem(CLAVE))
    return Number.isFinite(n) && n >= 1 && n <= 2000 ? Math.round(n) : 100
  } catch {
    return 100
  }
}
export function guardarPorcionDefecto(g: number | null) {
  try {
    if (g) localStorage.setItem(CLAVE, String(g))
    else localStorage.removeItem(CLAVE)
  } catch { /* sin storage */ }
}
