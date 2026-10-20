/**
 * POST /api/alimentos/afinar — afina con el catálogo de Supabase un plato analizado
 * fuera de Pages (API Gateway de visión). Solo recibe nombres y gramos, nunca la foto.
 * Si Supabase no responde, devuelve el plato tal cual con catalogo 'no_disponible'.
 */
import { z } from 'zod'
import type { Handler } from '../../utils/env.ts'
import { json } from '../../utils/response.ts'
import { leerBody } from '../../utils/http.ts'
import { exigirSesion } from '../../utils/session.ts'
import { exigirLimite } from '../../utils/rateLimit.ts'
import { afinarConCatalogo } from '../../utils/afinarCatalogo.ts'

const item = z.object({
  nombre: z.string().trim().min(1).max(80),
  gramos: z.number().finite().min(0).max(5000),
  calorias: z.number().finite().min(0).max(5000),
  proteinas: z.number().finite().min(0).max(500),
  carbohidratos: z.number().finite().min(0).max(1000),
  grasas: z.number().finite().min(0).max(500),
})
const cuerpo = z.object({ alimento: z.string().trim().min(1).max(80), items: z.array(item).min(1).max(12) })

export const onRequestPost: Handler = async ({ request, env, data }) => {
  const sesion = exigirSesion(data.sesion)
  const p = await leerBody(request, cuerpo, 16 * 1024)
  await exigirLimite(env, `afinar:u:${sesion.usuarioId}`, 120, 3600)
  const suma = (k: 'calorias' | 'proteinas' | 'carbohidratos' | 'grasas') => p.items.reduce((a, i) => a + i[k], 0)
  const a = await afinarConCatalogo(env, {
    input_query: '',
    display_name: p.alimento,
    nombre_plato: p.alimento,
    ingredientes: p.items.map((i) => ({ ...i, display_name: i.nombre, min_gramos: undefined, max_gramos: undefined })),
    calorias: suma('calorias'),
    proteinas: suma('proteinas'),
    carbohidratos: suma('carbohidratos'),
    grasas: suma('grasas'),
  })
  const r1 = (n: number | undefined) => Math.round((n ?? 0) * 10) / 10
  return json({
    ok: true,
    catalogo: a.catalogo,
    afinados: a.afinados,
    items: a.resultado.ingredientes.map((i) => ({ nombre: i.display_name || i.nombre, gramos: i.gramos, calorias: r1(i.calorias), proteinas: r1(i.proteinas), carbohidratos: r1(i.carbohidratos), grasas: r1(i.grasas) })),
    calorias: r1(a.resultado.calorias),
    macros: { proteinas: r1(a.resultado.proteinas), carbohidratos: r1(a.resultado.carbohidratos), grasas: r1(a.resultado.grasas) },
  })
}
