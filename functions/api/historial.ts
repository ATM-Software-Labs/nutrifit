/**
 * GET /api/historial?desde=YYYY-MM-DD&hasta=YYYY-MM-DD   (máx. 93 días)
 * Totales por día (kcal, P, C, G, nº comidas), agua, peso y medias del periodo.
 * El usuario sale SIEMPRE de la sesión. Límite: 60 / min por usuario.
 */
import type { Handler } from '../utils/env.ts'
import { json } from '../utils/response.ts'
import { queryObj, validar } from '../utils/http.ts'
import { historialQuery } from '../utils/schemas.ts'
import { exigirSesion } from '../utils/session.ts'
import { exigirLimite } from '../utils/rateLimit.ts'
import { obtenerUsuario } from '../utils/usuarios.ts'
import { agregarHistorial, type FilaComidasDia } from '../utils/historial.ts'

export const onRequestGet: Handler = async ({ request, env, data }) => {
  const sesion = exigirSesion(data.sesion)
  await exigirLimite(env, `historial:u:${sesion.usuarioId}`, 60, 60)
  const { desde, hasta } = validar(historialQuery, queryObj(request.url))
  const u = sesion.usuarioId
  const [comidas, agua, peso] = await env.DB.batch([
    env.DB.prepare(
      `SELECT fecha, SUM(calorias) AS calorias, SUM(proteinas) AS proteinas, SUM(carbohidratos) AS carbohidratos,
              SUM(grasas) AS grasas, COUNT(*) AS num_comidas
         FROM diario_comidas WHERE usuario_id = ?1 AND fecha BETWEEN ?2 AND ?3 GROUP BY fecha`,
    ).bind(u, desde, hasta),
    env.DB.prepare('SELECT fecha, ml FROM registro_agua WHERE usuario_id = ?1 AND fecha BETWEEN ?2 AND ?3').bind(u, desde, hasta),
    env.DB.prepare('SELECT fecha, peso FROM historico_peso WHERE usuario_id = ?1 AND fecha BETWEEN ?2 AND ?3 ORDER BY fecha').bind(u, desde, hasta),
  ])
  const usuario = await obtenerUsuario(env, u)
  const metas =
    usuario && usuario.meta_calorias !== null
      ? { calorias: usuario.meta_calorias, proteinas: usuario.meta_proteinas ?? 0, carbohidratos: usuario.meta_carbs ?? 0, grasas: usuario.meta_grasas ?? 0 }
      : null
  const h = agregarHistorial(
    desde,
    hasta,
    (comidas?.results ?? []) as FilaComidasDia[],
    (agua?.results ?? []) as { fecha: string; ml: number }[],
    (peso?.results ?? []) as { fecha: string; peso: number }[],
    metas,
  )
  return json({ ok: true, ...h })
}
