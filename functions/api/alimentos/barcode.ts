/**
 * GET /api/alimentos/barcode?ean=… — producto por código de barras.
 * Orden: catálogo local → productos propios → caché D1 (cache_off 'bc:<ean>')
 *   → OFF España → OFF mundo → USDA (Branded).
 * Timeouts cortos (2,5 s por espejo, 1 intento) para no colgar el escáner si OFF
 * se cae. Lo encontrado se guarda 30 días; si OFF falla se sirve la copia
 * caducada y, si no hay nada, se reintenta en segundo plano (waitUntil) para que
 * el siguiente escaneo ya lo encuentre. Si nadie lo tiene responde 404 con el
 * código normalizado para que la app ofrezca foto de la etiqueta o alta manual.
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

export const ESPEJOS_OFF = ['https://es.openfoodfacts.org', 'https://world.openfoodfacts.org']
const TTL_BC = 30 * 86_400

async function deOff(codigo: string, base: string, timeoutMs = 2500): Promise<Producto | null> {
  const data = (await pedirJson(`${base}/api/v2/product/${codigo}.json?fields=product_name_es,product_name,brands,nutriments`, 1, timeoutMs)) as
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
  const res = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?query=${codigo}&dataType=Branded&pageSize=5&api_key=${encodeURIComponent(clave)}`, { signal: AbortSignal.timeout(3000) })
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
  const clave = `bc:${ean}`
  let copia: { producto: Producto; origen: string; expira_en: number } | null = null
  if (env.DB) {
    try {
      const f = await env.DB.prepare('SELECT datos, expira_en FROM cache_off WHERE clave = ?1').bind(clave).first<{ datos: string; expira_en: number }>()
      if (f) copia = { ...(JSON.parse(f.datos) as { producto: Producto; origen: string }), expira_en: f.expira_en }
    } catch (e) { console.warn('[barcode] caché', e) }
  }
  const ahora = Math.floor(Date.now() / 1000)
  if (copia?.producto && copia.expira_en > ahora) return Response.json({ origen: copia.origen, cache: true, producto: { ...copia.producto, codigo_barras: ean } })

  const guardar = (producto: Producto, origen: string) => {
    if (!env.DB) return
    const t = Math.floor(Date.now() / 1000)
    context.waitUntil(
      env.DB.prepare('INSERT INTO cache_off (clave, datos, expira_en, actualizado) VALUES (?1, ?2, ?3, ?4) ON CONFLICT (clave) DO UPDATE SET datos = excluded.datos, expira_en = excluded.expira_en, actualizado = excluded.actualizado')
        .bind(clave, JSON.stringify({ producto: { ...producto, codigo_barras: ean }, origen }), t + TTL_BC, t).run().catch((e: unknown) => console.warn('[barcode] guardar caché', e)),
    )
  }
  const buscar = async (timeoutMs: number) => {
    let fallos = 0
    for (const base of ESPEJOS_OFF) {
      for (const v of variantes) {
        try { const p = await deOff(v, base, timeoutMs); if (p) return { p, origen: 'openfoodfacts', fallos } } catch (e) { fallos++; console.warn('[barcode] OFF', base, e instanceof Error ? e.message : e); break }
      }
    }
    try { const p = await deUsda(ean, env.USDA_API_KEY || 'DEMO_KEY'); if (p) return { p, origen: 'usda', fallos } } catch (e) { fallos++; console.warn('[barcode] USDA', e) }
    return { p: null, origen: '', fallos }
  }

  const r = await buscar(2500)
  if (r.p) {
    guardar(r.p, r.origen)
    return Response.json({ origen: r.origen, producto: { ...r.p, codigo_barras: ean } })
  }
  if (copia?.producto) return Response.json({ origen: copia.origen, cache: true, caducada: true, producto: { ...copia.producto, codigo_barras: ean } })
  const fallos = r.fallos
  if (fallos) {
    // OFF caído: reintento en segundo plano con más margen; el próximo escaneo lo leerá de la caché.
    context.waitUntil((async () => {
      await new Promise((ok) => setTimeout(ok, 5000))
      const r2 = await buscar(8000)
      if (r2.p) guardar(r2.p, r2.origen)
    })().catch(() => undefined))
  }
  return Response.json(
    { ok: false, codigo: ean, error: fallos ? 'Los catálogos de productos no responden ahora mismo. Haz una foto de la etiqueta o añádelo a mano.' : 'No encontramos este producto. Haz una foto de la etiqueta o añádelo a mano.' },
    { status: 404 },
  )
}
