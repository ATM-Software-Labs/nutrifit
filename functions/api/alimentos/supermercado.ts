import type { PagesFunction } from '@cloudflare/workers-types'

export const onRequestGet: PagesFunction = async (context) => {
  const { request } = context
  const url = new URL(request.url)
  const q = url.searchParams.get('q')?.trim()

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

    const data = await resMercadona.json()
    const items = (data.results || []).flatMap((r: any) => r.items || [])

    const formateados = items.slice(0, 15).map((item: any) => ({
      id: item.id,
      nombre: item.display_name,
      supermercado: 'Mercadona',
      precio: item.price_instructions?.unit_price || null,
      iva: item.price_instructions?.iva || null,
      foto: item.thumbnail || null
    }))

    return Response.json({ resultados: formateados })
  } catch (e: any) {
    return Response.json({ error: 'Error al conectar con el supermercado', resultados: [] }, { status: 500 })
  }
}
