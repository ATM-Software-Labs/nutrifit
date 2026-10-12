/**
 * GET /api/alimentos/barcode?ean=… — producto por código de barras.
 * Orden: catálogo local → productos propios → Open Food Facts → USDA (Branded).
 * Cada proveedor tiene su timeout; nunca deja la petición colgada. Si nadie lo
 * tiene responde 404 con el código normalizado para que la app ofrezca foto de
 * la etiqueta o alta manual.
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { exigirDesdeContexto } from '../../utils/identidad.ts'
import { error, HttpError } from '../../utils/response.ts'
import { sanitizarTextoLibre } from '../../utils/sanitizar.ts'
import { pedirJson } from '../../utils/off.ts'
import { normalizarEan, variantesEan } from '../../../src/lib/ean.ts'

interface Env {
  DB?: D1Database
  DB_ALIMENTOS?: D1Database
  USDA_API_KEY?: string
}
interface Producto { id: string; nombre: string; marca: string; calorias: number; proteinas: number; carbohidratos: number; grasas: number; codigo_barras: string }

const n = (v: unknown) => (Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : 0)
const r1 = (v: number) => Math.round(v * 10) / 10

async function deOff(codigo: string): Promise<Producto | null> {
  const data = (await pedirJson(`https://world.openfoodfacts.org/api/v2/product/${codigo}.json?fields=product_name_es,product_name,brands,nutriments`, 2, 5000)) as
    | { status?: number; product?: { product_name_es?: string; product_name?: string; brands?: string; nutriments?: Record<string, number | undefined> } }
    | null
  if (!data || data.status !== 1 || !data.product) return null
  const p = data.product, nu = p.nutriments || {}
  const kcal = nu['energy-kcal_100g'] ?? (nu['energy_100g'] ? nu['energy_100g'] / 4.184 : 0)
  return {
    id: crypto.randomUUID(),
    nombre: sanitizarTextoLibre(String(p.product_name_es || p.product_name || '')).slice(0, 120) || 'Producto sin nombre',
    marca: sanitizarTextoLibre(String(p.brands || '')).slice(0, 80) || 'Genérico',
    calorias: Math.round(n(kcal)),
    proteinas: r1(n(nu['proteins_100g'])),
    carbohidratos: r1(n(nu['carbohydrates_100g'])),
    grasas: r1(n(nu['fat_100g'])),
    codigo_barras: codigo,
  }
}

async function deUsda(codigo: string, clave: string): Promise<Producto | null> {
  const res = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?query=${codigo}&dataType=Branded&pageSize=5&api_key=${encodeURIComponent(clave)}`, { signal: AbortSignal.timeout(4000) })
  if (!res.ok) return null
  const d = (await res.json()) as { foods?: { description?: string; brandOwner?: string; brandName?: string; gtinUpc?: string; foodNutrients?: { nutrientNumber?: string; value?: number }[] }[] }
  const sinCeros = (s: string) => s.replace(/^0+/, '')
  const f = d.foods?.find((x) => x.gtinUpc && sinCeros(x.gtinUpc) === sinCeros(codigo))
  if (!f) return null
  const v = (num: string) => n(f.foodNutrients?.find((x) => x.nutrientNumber === num)?.value)
  return {
    id: crypto.randomUUID(),
    nombre: sanitizarTextoLibre(String(f.description || '')).slice(0, 120) || 'Producto sin nombre',
    marca: sanitizarTextoLibre(String(f.brandName || f.brandOwner || '')).slice(0, 80) || 'Genérico',
    calorias: Math.round(v('208')),
    proteinas: r1(v('203')),
    carbohidratos: r1(v('205')),
    grasas: r1(v('204')),
    codigo_barras: codigo,
  }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  let usuarioId: string
  try {
    usuarioId = (await exigirDesdeContexto(context.env, context.data)).usuarioId
  } catch (e) {
    if (e instanceof HttpError) return error(e.status, e.message, e.extra)
    return error(401, 'Necesitas iniciar sesión.')
  }
  const { request, env } = context
  const bruto = new URL(request.url).searchParams.get('ean')?.trim() ?? ''
  const ean = normalizarEan(bruto)
  if (!ean) return Response.json({ ok: false, error: 'Ese código de barras no es válido. Revisa los números o vuelve a escanearlo.', codigo: bruto.replace(/\D/g, '') }, { status: 400 })
  const variantes = variantesEan(ean)
  const marcas = variantes.map(() => '?').join(',')

  if (env.DB_ALIMENTOS) {
    try {
      const p = await env.DB_ALIMENTOS.prepare(`SELECT id, nombre, marca, calorias, proteinas, carbohidratos, grasas, codigo_barras FROM alimentos WHERE codigo_barras IN (${marcas}) LIMIT 1`).bind(...variantes).first()
      if (p) return Response.json({ origen: 'd1_local', producto: p })
    } catch (e) { console.warn('[barcode] catálogo local', e) }
  }
  if (env.DB) {
    try {
      const p = await env.DB.prepare(`SELECT id, nombre, COALESCE(marca, '') AS marca, calorias, proteinas, carbohidratos, grasas, codigo AS codigo_barras FROM productos_usuario WHERE usuario_id = ? AND codigo IN (${marcas}) LIMIT 1`).bind(usuarioId, ...variantes).first()
      if (p) return Response.json({ origen: 'propio', producto: p })
    } catch (e) { console.warn('[barcode] productos propios', e) }
  }
  let fallos = 0
  for (const v of variantes) {
    try { const p = await deOff(v); if (p) return Response.json({ origen: 'openfoodfacts', producto: { ...p, codigo_barras: ean } }) } catch (e) { fallos++; console.warn('[barcode] OFF', e) }
  }
  try { const p = await deUsda(ean, env.USDA_API_KEY || 'DEMO_KEY'); if (p) return Response.json({ origen: 'usda', producto: { ...p, codigo_barras: ean } }) } catch (e) { console.warn('[barcode] USDA', e) }
  return Response.json(
    { ok: false, codigo: ean, error: fallos ? 'Los catálogos de productos no responden ahora mismo. Haz una foto de la etiqueta o añádelo a mano.' : 'No encontramos este producto. Haz una foto de la etiqueta o añádelo a mano.' },
    { status: 404 },
  )
}
