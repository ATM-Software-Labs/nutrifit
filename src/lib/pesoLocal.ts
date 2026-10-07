/**
 * Pesos aún no volcados a D1. La gráfica los pinta al momento. localStorage
 * es la copia síncrona; IndexedDB sobrevive si la pestaña se cierra a medias.
 */
import { idbDelete, idbPut } from './localDb.ts'

const CLAVE = 'nf:peso:outbox'

type Caja = Record<string, number>

export function leerPesosLocales(): Caja {
  try {
    const raw = localStorage.getItem(CLAVE)
    if (!raw) return {}
    const datos = JSON.parse(raw) as unknown
    if (!datos || typeof datos !== 'object') return {}
    const caja: Caja = {}
    for (const [fecha, peso] of Object.entries(datos)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || typeof peso !== 'number') continue
      if (peso >= 30 && peso <= 300) caja[fecha] = peso
    }
    return caja
  } catch {
    return {}
  }
}

export function guardarPesoLocal(fecha: string, peso: number) {
  const caja = leerPesosLocales()
  caja[fecha] = peso
  escribir(caja)
  void idbPut('peso', fecha, peso)
}

export function olvidarPesoLocal(fecha: string) {
  const caja = leerPesosLocales()
  if (caja[fecha] === undefined) {
    void idbDelete('peso', fecha)
    return
  }
  delete caja[fecha]
  escribir(caja)
  void idbDelete('peso', fecha)
}

function escribir(caja: Caja) {
  try {
    if (Object.keys(caja).length === 0) localStorage.removeItem(CLAVE)
    else localStorage.setItem(CLAVE, JSON.stringify(caja))
  } catch {
    /* cuota o modo privado: el registro sigue en memoria de la gráfica */
  }
}
