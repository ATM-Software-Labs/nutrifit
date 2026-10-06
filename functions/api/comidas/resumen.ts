/**
 * GET /api/comidas/resumen?fecha=YYYY-MM-DD
 * El usuario SIEMPRE sale de la cookie de sesión (nunca de un parámetro) → sin IDOR.
 */
import type { Handler } from '../../utils/env.ts'
import { json } from '../../utils/response.ts'
import { queryObj, validar } from '../../utils/http.ts'
import { resumenQuery, TIPOS_COMIDA } from '../../utils/schemas.ts'
import { exigirSesion } from '../../utils/session.ts'
import { obtenerUsuario } from '../../utils/usuarios.ts'
import { aComidaApi, type FilaComida } from '../../utils/comidas.ts'
import { hoy } from '../../utils/fechas.ts'

type Totales = { calorias: number; proteinas: number; carbohidratos: number; grasas: number }
const r1 = (n: number) => Math.round(n * 10) / 10

export const onRequestGet: Handler = async ({ request, env, data }) => {
  const sesion = exigirSesion(data.sesion)
  const q = queryObj(request.url)
  const { fecha } = validar(resumenQuery, { fecha: q.fecha ?? hoy() })

  const [comidasRes, aguaRes] = await env.DB.batch([
    env.DB.prepare('SELECT * FROM diario_comidas WHERE usuario_id = ?1 AND fecha = ?2 ORDER BY creado_en').bind(sesion.usuarioId, fecha),
    env.DB.prepare('SELECT ml FROM registro_agua WHERE usuario_id = ?1 AND fecha = ?2').bind(sesion.usuarioId, fecha),
  ])
  const filas = (comidasRes?.results ?? []) as FilaComida[]
  const usuario = await obtenerUsuario(env, sesion.usuarioId)

  const comidas = Object.fromEntries(TIPOS_COMIDA.map((t) => [t, [] as ReturnType<typeof aComidaApi>[]]))
  const totales: Totales = { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 }
  for (const f of filas) {
    comidas[f.tipo_comida]!.push(aComidaApi(f))
    totales.calorias += f.calorias
    totales.proteinas += f.proteinas
    totales.carbohidratos += f.carbohidratos
    totales.grasas += f.grasas
  }
  for (const k of Object.keys(totales) as (keyof Totales)[]) totales[k] = r1(totales[k])

  const metas: Totales | null =
    usuario && usuario.meta_calorias !== null
      ? {
          calorias: usuario.meta_calorias,
          proteinas: usuario.meta_proteinas ?? 0,
          carbohidratos: usuario.meta_carbs ?? 0,
          grasas: usuario.meta_grasas ?? 0,
        }
      : null

  const restante = metas && (Object.fromEntries((Object.keys(metas) as (keyof Totales)[]).map((k) => [k, r1(metas[k] - totales[k])])) as Totales)
  const porcentaje =
    metas &&
    (Object.fromEntries((Object.keys(metas) as (keyof Totales)[]).map((k) => [k, metas[k] > 0 ? Math.round((totales[k] / metas[k]) * 100) : 0])) as Totales)

  const agua = (aguaRes?.results?.[0] as { ml?: number } | undefined)?.ml ?? 0
  return json({ ok: true, fecha, comidas, totales, metas, restante, porcentaje, agua_ml: agua, num_comidas: filas.length })
}
