/**
 * Último contenido que el servidor confirmó, por clave (`agua:2026-10-06`,
 * `peso:2026-10-06`, `perfil`). Si el hash nuevo coincide, no se sube nada.
 */
const CLAVE = 'nf:last_synced_hash'

function leerMapa(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CLAVE)
    if (!raw) return {}
    const datos = JSON.parse(raw) as unknown
    if (!datos || typeof datos !== 'object') return {}
    const mapa: Record<string, string> = {}
    for (const [k, v] of Object.entries(datos)) {
      if (typeof v === 'string' && /^[a-f0-9]{64}$/.test(v)) mapa[k] = v
    }
    return mapa
  } catch {
    return {}
  }
}

export function leerHashSincronizado(clave: string): string | null {
  return leerMapa()[clave] ?? null
}

export function guardarHashSincronizado(clave: string, hash: string) {
  try {
    const mapa = leerMapa()
    mapa[clave] = hash
    localStorage.setItem(CLAVE, JSON.stringify(mapa))
  } catch {
    /* sin almacenamiento la próxima subida repetirá el POST; el Worker sigue pudiendo responder 304 */
  }
}
