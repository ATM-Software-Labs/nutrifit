/**
 * POST /api/comidas/analizar-texto  { descripcion, turnstileToken }
 * «2 plátanos» o «un vaso de leche» → mismo JSON que el análisis de fotos.
 * Las medidas coloquiales pasan por la tabla de raciones (functions/utils/raciones.ts)
 * y los macros se escalan a esos gramos. Middleware: sesión
 * previa + Turnstile + 20 / hora por usuario. Aquí: 30 análisis de texto / día por usuario.
 */
import type { Handler } from '../../utils/env.ts'
import { error, json } from '../../utils/response.ts'
import { leerBody } from '../../utils/http.ts'
import { analizarTextoSchema } from '../../utils/schemas.ts'
import { exigirSesion } from '../../utils/session.ts'
import { exigirLimite } from '../../utils/rateLimit.ts'
import { analizarTexto, ErrorIA } from '../../utils/ia.ts'

export const onRequestPost: Handler = async ({ request, env, data }) => {
  const sesion = exigirSesion(data.sesion)
  const { descripcion } = await leerBody(request, analizarTextoSchema)
  await exigirLimite(env, `analizar-texto:u:${sesion.usuarioId}`, 30, 86400, 'Has alcanzado el límite de 30 descripciones diarias. Puedes buscar el alimento o añadirlo a mano.')
  try {
    const { proveedor, resultado } = await analizarTexto(env, descripcion)
    return json({ ok: true, proveedor, resultado })
  } catch (e) {
    if (e instanceof ErrorIA) {
      return error(503, 'No hemos podido estimarlo ahora mismo. Inténtalo de nuevo o búscalo en la base de alimentos.', { codigo: 'ia_no_disponible' })
    }
    throw e
  }
}
