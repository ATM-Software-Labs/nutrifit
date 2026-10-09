import type { PagesFunction } from '@cloudflare/workers-types'
import { exigirDesdeContexto } from '../../utils/identidad.ts'
import { error, HttpError } from '../../utils/response.ts'
import { sanitizarTextoLibre } from '../../utils/sanitizar.ts'

interface Env {
  DB_ALIMENTOS?: D1Database
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    await exigirDesdeContexto(context.env, context.data)
  } catch (e) {
    if (e instanceof HttpError) return error(e.status, e.message, e.extra)
    return error(401, 'Necesitas iniciar sesión.')
  }
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

    const data = (await resOff.json()) as {
      status?: number
      product?: {
        product_name_es?: string
        product_name?: string
        brands?: string
        nutriments?: Record<string, number | undefined>
      }
    }
    if (data.status !== 1 || !data.product) {
      return Response.json({ error: 'Producto no registrado en Open Food Facts' }, { status: 404 })
    }

    const p = data.product
    const nutriments = p.nutriments || {}

    const nombrePlano = sanitizarTextoLibre(String(p.product_name_es || p.product_name || '')).slice(0, 120)
    const marcaPlana = sanitizarTextoLibre(String(p.brands || '')).slice(0, 80)
    const producto = {
      id: crypto.randomUUID(),
      nombre: nombrePlano || 'Producto sin nombre',
      marca: marcaPlana || 'Genérico',
      calorias: Math.round(nutriments['energy-kcal_100g'] || (nutriments['energy_100g'] ? nutriments['energy_100g'] / 4.184 : 0)),
      proteinas: Number(nutriments['proteins_100g'] || 0),
      carbohidratos: Number(nutriments['carbohydrates_100g'] || 0),
      grasas: Number(nutriments['fat_100g'] || 0),
      codigo_barras: ean
    }

    return Response.json({ origen: 'openfoodfacts', producto })
  } catch {
    return Response.json({ error: 'Fallo al consultar proveedor de alimentos' }, { status: 502 })
  }
}
