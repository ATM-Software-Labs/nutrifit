/**
 * GET /assets/* — guardián de los recursos con hash de Vite.
 *
 * Cloudflare (Pages + caché del dominio) guarda /assets/* con Cache-Control
 * inmutable de 1 año. Durante la propagación de un despliegue, una máquina que
 * aún sirve la versión anterior respondía a una URL nueva con el index.html del
 * fallback SPA (200) o con un 404, y esa respuesta quedaba cacheada en el borde
 * un año → JS/CSS rotos (nosniff) y pantalla blanca para todos en ese PoP.
 *
 * Aquí solo se marca como inmutable una respuesta 200 del tipo correcto; todo
 * lo demás sale como 404 `no-store`, que nadie (borde, navegador, SW) guarda.
 * public/_routes.json incluye /assets/* para que se ejecute.
 */
import type { Handler } from '../utils/env.ts'

function tipoEsperado(ruta: string): string | null {
  if (/\.m?js$/.test(ruta)) return 'javascript'
  if (/\.css$/.test(ruta)) return 'text/css'
  return null
}

export const onRequest: Handler = async ({ request, next }) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } })
  const res = await next()
  const ruta = new URL(request.url).pathname
  const tipo = (res.headers.get('content-type') ?? '').toLowerCase()
  const esperado = tipoEsperado(ruta)

  if (res.status === 304) return res
  const valido = res.status === 200 && !tipo.includes('text/html') && (!esperado || tipo.includes(esperado))
  if (!valido) {
    return new Response('Recurso no encontrado.', {
      status: 404,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  }
  const r = new Response(res.body, res)
  r.headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  return r
}
