import type { PagesFunction } from '@cloudflare/workers-types'
import { exigirDesdeContexto } from '../../utils/identidad.ts'
import { error, HttpError } from '../../utils/response.ts'
import { sanitizarTextoLibre } from '../../utils/sanitizar.ts'

export const onRequestGet: PagesFunction = async (context) => {
  try {
    await exigirDesdeContexto(context.env, context.data)
  } catch (e) {
    if (e instanceof HttpError) return error(e.status, e.message, e.extra)
    return error(401, 'Necesitas iniciar sesión.')
  }
  const { request } = context
  const url = new URL(request.url)
  const q = sanitizarTextoLibre(url.searchParams.get('q') ?? '').slice(0, 60)

  if (!q || q.length < 2) {
    return Response.json({ resultados: [] })
  }

  try {
    const resMercadona = await fetch(`https://tienda.mercadona.es/api/v1_1/search/?q=${encodeURIComponent(q)}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(4000)
    })

    if (!resMercadona.ok) {
      return Response.json({ resultados: [] })
    }

    const data = (await resMercadona.json()) as { results?: { items?: unknown[] }[] }
    const items = (data.results || []).flatMap((r) => r.items || [])

    const formateados = items.slice(0, 15).map((item: any) => ({
      id: item.id,
      nombre: typeof item.display_name === 'string' ? sanitizarTextoLibre(item.display_name).slice(0, 120) : '',
      supermercado: 'Mercadona',
      precio: item.price_instructions?.unit_price || null,
      iva: item.price_instructions?.iva || null,
      foto: typeof item.thumbnail === 'string' && item.thumbnail.startsWith('https://') ? item.thumbnail.slice(0, 500) : null
    }))

    return Response.json({ resultados: formateados })
  } catch {
    return Response.json({ error: 'Error al conectar con el supermercado', resultados: [] }, { status: 500 })
  }
}
