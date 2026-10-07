/**
 * GET /api/alimentos/barcode?codigo=8480000610553
 * Open Food Facts v2. Prioriza las cadenas españolas (Mercadona / Hacendado,
 * Carrefour, Caprabo, Eroski, Dia, Lidl) y normaliza por 100 g y por porción.
 * Un acierto se guarda 30 días en catalogo_alimentos_cache.
 * El producto propio del usuario, si existe, gana al catálogo público.
 * Límite: 30 códigos/min por usuario.
 */
import type { Handler } from '../../utils/env.ts'
import { error, HttpError, json } from '../../utils/response.ts'
import { queryObj, validar } from '../../utils/http.ts'
import { barcodeQuery } from '../../utils/schemas.ts'
import { exigirSesion } from '../../utils/session.ts'
import { exigirLimite } from '../../utils/rateLimit.ts'
import { productoPropioPorCodigo, type ProductoPropio } from '../../utils/productos.ts'
import { cerrarNutrientes, detectarCadenas, escalarNutrientes, productoCatalogoPorCodigo, type AlimentoCatalogo } from '../../utils/catalogoAlimentos.ts'

function desdePropio(p: ProductoPropio): AlimentoCatalogo {
  const por100 = cerrarNutrientes({
    energia_kcal: p.por100.calorias,
    proteinas: p.por100.proteinas,
    carbohidratos: p.por100.carbohidratos,
    azucares: p.extra.azucares,
    grasas: p.por100.grasas,
    grasas_saturadas: p.extra.saturadas,
    fibra: p.extra.fibra,
    sal: p.extra.sal,
  })
  const cadenas = detectarCadenas({ brands: p.marca })
  return {
    id: p.id,
    codigo: p.codigo || null,
    nombre: p.nombre,
    marca: p.marca,
    cadenas,
    cadena_prioritaria: cadenas[0] ?? null,
    unidad: p.unidad,
    por_100g: por100,
    gramos_porcion: p.racion,
    por_porcion: p.racion ? escalarNutrientes(por100, p.racion) : null,
    fuente: 'propio',
  }
}

export const onRequestGet: Handler = async (ctx) => {
  const { request, env, data } = ctx
  const sesion = exigirSesion(data.sesion)
  const { codigo } = validar(barcodeQuery, queryObj(request.url))
  await exigirLimite(env, `barcode:u:${sesion.usuarioId}`, 30, 60, 'Demasiados códigos seguidos. Espera un momento.')
  const propio = await productoPropioPorCodigo(env, sesion.usuarioId, codigo)
  if (propio) return json({ ok: true, producto: desdePropio(propio), cache: false })
  try {
    const { producto, cache } = await productoCatalogoPorCodigo(codigo, { env, waitUntil: ctx.waitUntil.bind(ctx) })
    return json({ ok: true, producto, cache })
  } catch (e) {
    if (e instanceof HttpError) throw e
    console.warn('[barcode] fallo:', e instanceof Error ? e.message : e)
    return error(503, 'Open Food Facts no responde ahora mismo. Prueba de nuevo en unos minutos.', { codigo: 'off_no_disponible' })
  }
}
