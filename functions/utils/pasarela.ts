/**
 * Contrato entre el API Gateway y Pages.
 * El navegador habla con api.trujillomingorance.com. Pages sigue siendo el origen.
 */
export const URL_PAGINA = 'https://nutri.trujillomingorance.com'
export const URL_PASARELA = 'https://api.trujillomingorance.com'

const PAGINAS = new Set([
  URL_PAGINA,
  'https://nutrifit-ac9.pages.dev',
  'http://localhost:8788',
  'http://127.0.0.1:8788',
])

/** Dev de Pages. El Vite de 5173 no entra: ahí la cookie sigue en el mismo origen. */
export function origenLocalPages(url: string): string | null {
  try {
    const origen = new URL(url).origin
    return origen === 'http://localhost:8788' || origen === 'http://127.0.0.1:8788' ? origen : null
  } catch {
    return null
  }
}

/**
 * `/v1/comidas/resumen` → `https://nutri…/api/comidas/resumen`.
 * La visión no se reenvía: la resuelve el propio Worker.
 * Un origen fuera de la lista no sale a la red.
 */
export function destinoDeProxy(ruta: string, search: string, origenPagina: string | undefined): string | null {
  if (!origenPagina) return null
  let origen: string
  try {
    const u = new URL(origenPagina)
    if (u.username || u.password || u.pathname !== '/' || u.search || u.hash) return null
    origen = u.origin
  } catch {
    return null
  }
  if (!PAGINAS.has(origen)) return null
  if (ruta !== '/v1' && !ruta.startsWith('/v1/')) return null
  if (ruta === '/v1/nutrifit/vision') return null
  const resto = ruta === '/v1' ? '' : ruta.slice(3)
  if (resto !== '' && !resto.startsWith('/')) return null
  return `${origen}/api${resto}${search}`
}

/** Un 302 relativo debe volver a la PWA, no quedarse en el host del API. */
export function reescribirLocation(location: string): string {
  if (location.startsWith('/') && !location.startsWith('//')) return `${URL_PAGINA}${location}`
  try {
    const u = new URL(location)
    if (u.origin === URL_PAGINA && (u.pathname === '/api' || u.pathname.startsWith('/api/'))) {
      const resto = u.pathname.slice(4)
      return `${URL_PASARELA}/v1${resto}${u.search}${u.hash}`
    }
  } catch {
    /* la URL no se toca */
  }
  return location
}
