/** Preferencias locales de cantidades: última elección por producto y bebidas → agua. */
const CLAVE_TODAS = 'nf:agua_todas_bebidas'
const CLAVE_PROD = 'nf:cantidad_producto'

export const contarTodasBebidas = () => {
  try { return localStorage.getItem(CLAVE_TODAS) === '1' } catch { return false }
}
export const setContarTodasBebidas = (v: boolean) => {
  try { localStorage.setItem(CLAVE_TODAS, v ? '1' : '0') } catch { /* sin almacenamiento */ }
}

type Memoria = Record<string, { cantidad: number; clave?: string; t: number }>
const leer = (): Memoria => {
  try { return JSON.parse(localStorage.getItem(CLAVE_PROD) || '{}') as Memoria } catch { return {} }
}

/** Última cantidad elegida para este producto (código de barras o nombre). */
export function ultimaCantidad(id: string | null | undefined): { cantidad: number; clave?: string } | null {
  if (!id) return null
  return leer()[id] ?? null
}

export function recordarCantidad(id: string | null | undefined, cantidad: number, clave?: string) {
  if (!id || !(cantidad > 0)) return
  const m = leer()
  m[id] = { cantidad, clave, t: Date.now() }
  // Como mucho 200 productos: se olvidan los más antiguos.
  const ids = Object.keys(m).sort((a, b) => m[b]!.t - m[a]!.t).slice(200)
  for (const i of ids) delete m[i]
  try { localStorage.setItem(CLAVE_PROD, JSON.stringify(m)) } catch { /* lleno */ }
}
