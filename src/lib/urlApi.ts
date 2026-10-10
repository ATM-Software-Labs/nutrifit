/**
 * Une la base (`VITE_API_URL`) con una ruta histórica `/api/...`.
 * Si la base termina en `/v1`, quita ese prefijo: el gateway ya versiona.
 * En local (`http://localhost:5173`) la ruta se conserva y Vite la reenvía.
 */
export function unirApi(base: string, ruta: string): string {
  const limpia = base.replace(/\/$/, '')
  const corte = ruta.indexOf('?')
  const path = corte === -1 ? ruta : ruta.slice(0, corte)
  const search = corte === -1 ? '' : ruta.slice(corte)
  const normal = path.startsWith('/') ? path : `/${path}`
  const sinApi = /\/nutrifit$/i.test(limpia) ? normal.replace(/^\/api(?=\/|$)/, '') : normal
  const final = sinApi.startsWith('/') ? sinApi : `/${sinApi}`
  return `${limpia}${final}${search}`
}

/** La miniatura guardada sigue siendo `/api/archivos/:id`. Aquí se vuelve absoluta. */
export function urlDeArchivo(base: string, valor: string): string {
  const v = valor.trim()
  if (v.startsWith('/api/archivos/')) return unirApi(base, v)
  return v
}
