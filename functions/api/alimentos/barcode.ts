import type { PagesFunction } from '@cloudflare/workers-types'

interface Env {
  DB_ALIMENTOS?: D1Database
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const url = new URL(request.url)
  const ean = url.searchParams.get('ean')?.trim()

  if (!ean || !/^\d{8,14}$/.test(ean)) {
    return Response.json({ error: 'Código de barras no válido' }, { status: 400 })
  }

  if (env.DB_ALIMENTOS) {
    try {
      const prodLocal = await env.DB_ALIMENTOS.prepare(
        `SELECT id, nombre, marca, calorias, proteinas, carbohidratos, grasas, codigo_barras 
         FROM alimentos WHERE codigo_barras = ? LIMIT 1`
      ).bind(ean).first()

      if (prodLocal) {
        return Response.json({ origen: 'd1_local', producto: prodLocal })
      }
    } catch (e) {
      console.warn('Error leyendo D1 alimentos:', e)
    }
  }

  try {
    const resOff = await fetch(`https://world.openfoodfacts.org/api/v2/product/${ean}.json`, {
      headers: { 'User-Agent': 'NutriFit-App/1.0 (nutri@trujillomingorance.com)' },
      signal: AbortSignal.timeout(5000)
    })

    if (!resOff.ok) {
      return Response.json({ error: 'Producto no encontrado' }, { status: 404 })
    }

    const data = await resOff.json()
    if (data.status !== 1 || !data.product) {
      return Response.json({ error: 'Producto no registrado en Open Food Facts' }, { status: 404 })
    }

    const p = data.product
    const nutriments = p.nutriments || {}

    const producto = {
      id: crypto.randomUUID(),
      nombre: p.product_name_es || p.product_name || 'Producto sin nombre',
      marca: p.brands || 'Genérico',
      calorias: Math.round(nutriments['energy-kcal_100g'] || (nutriments['energy_100g'] ? nutriments['energy_100g'] / 4.184 : 0)),
      proteinas: Number(nutriments['proteins_100g'] || 0),
      carbohidratos: Number(nutriments['carbohydrates_100g'] || 0),
      grasas: Number(nutriments['fat_100g'] || 0),
      codigo_barras: ean
    }

    return Response.json({ origen: 'openfoodfacts', producto })
  } catch (err: any) {
    return Response.json({ error: 'Fallo al consultar proveedor de alimentos', detalle: err.message }, { status: 502 })
  }
}
