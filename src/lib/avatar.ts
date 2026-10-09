/** Retrato generado cuando no hay archivo o la foto guardada no carga. */
const UUID_ARCHIVO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function rutaDe(valor: string): string | null {
  if (valor.startsWith('/')) return (valor.split('?')[0] ?? valor)
  if (valor.startsWith('https://') || valor.startsWith('http://')) {
    try {
      return new URL(valor).pathname
    } catch {
      return null
    }
  }
  return null
}

/** true solo si la cadena es `/api/archivos/:uuid` o `/v1/archivos/:uuid` con un id real. */
export function idArchivoValido(valor: string): boolean {
  const ruta = rutaDe(valor.trim())
  if (!ruta) return false
  const trozos = ruta.split('/').filter(Boolean)
  if (trozos.length !== 3 || trozos[1] !== 'archivos') return false
  if (trozos[0] !== 'api' && trozos[0] !== 'v1') return false
  return UUID_ARCHIVO.test(trozos[2] ?? '')
}

/**
 * Ruta de archivo que no debe pedirse: falta el uuid o el id está alterado.
 * Otras URLs (Google, data, blob) no se tocan.
 */
export function archivoRechazado(valor: string): boolean {
  const ruta = rutaDe(valor.trim())
  if (!ruta || !/^\/(?:api|v1)\/archivos\//.test(ruta)) return false
  return !idArchivoValido(valor)
}

export function avatarGenerado(nombre: string): string {
  const limpio = nombre.replace(/^@/, '').trim() || 'NutriFit'
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(limpio)}&background=064e3b&color=34d399&bold=true`
}
