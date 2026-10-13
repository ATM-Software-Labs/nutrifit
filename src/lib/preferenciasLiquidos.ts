/**
 * Preferencias de cantidades: última elección por producto y «todas las
 * bebidas suman al agua». Se guardan en el dispositivo (respuesta inmediata)
 * y se sincronizan con el servidor (/api/preferencias/cantidades) para que
 * valgan en todos los dispositivos; gana lo más reciente.
 */
import { fusionar, MAX_PRODUCTOS, type PrefCantidades } from './preferenciasCantidades.ts'

const CLAVE = 'nf:pref_cantidades'

function leerLocal(): PrefCantidades {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE) || 'null') as PrefCantidades | null
    if (v && typeof v === 'object' && v.cantidades) return v
  } catch { /* corrupto */ }
  // Migración de las claves antiguas (solo locales).
  let cantidades: PrefCantidades['cantidades'] = {}
  try { cantidades = JSON.parse(localStorage.getItem('nf:cantidad_producto') || '{}') } catch { /* nada */ }
  const todas = (() => { try { return localStorage.getItem('nf:agua_todas_bebidas') === '1' } catch { return false } })()
  return { aguaTodasBebidas: todas, aguaT: 0, cantidades }
}
function guardarLocal(p: PrefCantidades) {
  try { localStorage.setItem(CLAVE, JSON.stringify(p)) } catch { /* lleno */ }
}

let espera: number | undefined
function subir() {
  if (typeof window === 'undefined') return
  window.clearTimeout(espera)
  espera = window.setTimeout(() => void enviar(), 1500)
}
async function enviar() {
  try {
    const { api } = await import('./api.ts')
    const r = await api.guardarPrefCantidades(leerLocal())
    guardarLocal(fusionar(leerLocal(), { aguaTodasBebidas: r.aguaTodasBebidas, aguaT: r.aguaT, cantidades: r.cantidades }))
  } catch { /* sin red: se reintenta en la próxima sincronización */ }
}

/** Al abrir la app: trae lo del servidor, fusiona y sube si había cambios locales. */
export async function sincronizarPreferenciasCantidades() {
  try {
    const { api } = await import('./api.ts')
    const r = await api.prefCantidades()
    const remoto: PrefCantidades = { aguaTodasBebidas: r.aguaTodasBebidas, aguaT: r.aguaT, cantidades: r.cantidades }
    const local = leerLocal()
    const fusion = fusionar(remoto, local)
    guardarLocal(fusion)
    if (JSON.stringify(fusion) !== JSON.stringify(fusionar(remoto, remoto))) subir()
  } catch { /* sin red */ }
}

export const contarTodasBebidas = () => leerLocal().aguaTodasBebidas
export function setContarTodasBebidas(v: boolean) {
  guardarLocal({ ...leerLocal(), aguaTodasBebidas: v, aguaT: Date.now() })
  subir()
}

/** Última cantidad elegida para este producto (código de barras o id). */
export function ultimaCantidad(id: string | null | undefined): { cantidad: number; clave?: string } | null {
  if (!id) return null
  return leerLocal().cantidades[id.slice(0, 80)] ?? null
}

export function recordarCantidad(id: string | null | undefined, cantidad: number, clave?: string) {
  if (!id || !(cantidad > 0)) return
  const p = leerLocal()
  const nuevo: PrefCantidades = { ...p, cantidades: { ...p.cantidades, [id.slice(0, 80)]: { cantidad: Math.round(cantidad * 10) / 10, ...(clave ? { clave } : {}), t: Date.now() } } }
  guardarLocal(fusionar(nuevo, { aguaTodasBebidas: false, aguaT: -1, cantidades: {} }))
  subir()
}
export { MAX_PRODUCTOS }
