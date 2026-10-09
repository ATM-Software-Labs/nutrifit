/**
 * GET  /api/comidas/frecuentes
 * POST /api/comidas/frecuentes
 * El usuario_id es el de la sesión. nombre, items y comentario se sanitizan.
 */
import type { Handler } from '../../../utils/env.ts'
import { error, json } from '../../../utils/response.ts'
import { leerBody } from '../../../utils/http.ts'
import { comidaFrecuenteSchema } from '../../../utils/schemas.ts'
import { exigirIdentidad } from '../../../utils/identidad.ts'
import { exigirLimite } from '../../../utils/rateLimit.ts'
import { presentarTexto } from '../../../utils/sanitizar.ts'
import { HttpError } from '../../../utils/response.ts'

interface Fila {
  id: string
  tipo_comida: string | null
  nombre: string
  items_json: string | null
  creado_en: string
}

interface ItemGuardado {
  nombre?: string
  gramos?: number
  calorias?: number
  proteinas?: number
  carbohidratos?: number
  grasas?: number
  comentario?: string
}

function leerJson(raw: string | null): { items: ItemGuardado[]; comentario: string | null } {
  if (!raw) return { items: [], comentario: null }
  try {
    const v = JSON.parse(raw) as unknown
    if (Array.isArray(v)) return { items: v as ItemGuardado[], comentario: null }
    if (v && typeof v === 'object') {
      const o = v as { items?: unknown; comentario?: unknown }
      return {
        items: Array.isArray(o.items) ? (o.items as ItemGuardado[]) : [],
        comentario: typeof o.comentario === 'string' ? o.comentario : null,
      }
    }
  } catch {
    /* JSON inválido heredado: se enseña vacío, no se rompe el listado */
  }
  return { items: [], comentario: null }
}

function presentar(f: Fila) {
  const { items, comentario } = leerJson(f.items_json)
  return {
    id: f.id,
    tipo_comida: f.tipo_comida,
    nombre: presentarTexto(f.nombre),
    comentario: presentarTexto(comentario),
    items: items.map((it) => ({
      nombre: presentarTexto(it.nombre) ?? '',
      gramos: it.gramos,
      calorias: it.calorias,
      proteinas: it.proteinas,
      carbohidratos: it.carbohidratos,
      grasas: it.grasas,
      comentario: presentarTexto(it.comentario),
    })),
    creado_en: f.creado_en,
  }
}

export const onRequestGet: Handler = async ({ env, data }) => {
  const sesion = await exigirIdentidad(env, data.sesion)
  const { results } = await env.DB.prepare(
    `SELECT id, tipo_comida, nombre, items_json, creado_en
     FROM comidas_frecuentes WHERE usuario_id = ?1 ORDER BY creado_en DESC LIMIT 100`,
  )
    .bind(sesion.usuarioId)
    .all<Fila>()
  return json({ ok: true, comidas: (results ?? []).map(presentar) })
}

export const onRequestPost: Handler = async ({ request, env, data }) => {
  const sesion = await exigirIdentidad(env, data.sesion)
  const c = await leerBody(request, comidaFrecuenteSchema)
  await exigirLimite(env, `frecuentes:u:${sesion.usuarioId}`, 60, 3600, 'Has guardado demasiadas comidas. Espera un rato.')
  const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM comidas_frecuentes WHERE usuario_id = ?1').bind(sesion.usuarioId).first<{ n: number }>()
  if ((n?.n ?? 0) >= 100) return error(409, 'Has llegado al máximo de 100 comidas frecuentes.')
  const items = {
    items: (c.items ?? []).map((it) => ({
      nombre: it.nombre,
      gramos: it.gramos,
      calorias: it.calorias,
      proteinas: it.proteinas,
      carbohidratos: it.carbohidratos,
      grasas: it.grasas,
      comentario: it.comentario || null,
    })),
    comentario: c.comentario || null,
  }
  const jsonItems = JSON.stringify(items)
  if (jsonItems.length > 20000) throw new HttpError(400, 'La comida frecuente es demasiado grande.')
  const id = crypto.randomUUID()
  const fila = await env.DB.prepare(
    `INSERT INTO comidas_frecuentes (id, usuario_id, tipo_comida, nombre, items_json)
     VALUES (?1, ?2, ?3, ?4, ?5)
     RETURNING id, tipo_comida, nombre, items_json, creado_en`,
  )
    .bind(id, sesion.usuarioId, c.tipo_comida, c.nombre, jsonItems)
    .first<Fila>()
  return json({ ok: true, comida: fila ? presentar(fila) : null }, { status: 201 })
}
