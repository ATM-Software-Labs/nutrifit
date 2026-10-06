/**
 * POST /api/comidas/analizar-texto  { descripcion, turnstileToken }
 * «2 huevos revueltos y una tostada con aceite» → mismo JSON que el análisis
 * de fotos (se revisa en el cliente antes de guardar). Middleware: sesión
 * previa + Turnstile + 20 / min por IP. Aquí: 30 análisis de texto / día por usuario.
 */
import type { Handler } from '../../utils/env.ts'
import { error, json } from '../../utils/response.ts'
import { leerBody } from '../../utils/http.ts'
import { analizarTextoSchema } from '../../utils/schemas.ts'
import { exigirSesion } from '../../utils/session.ts'
import { exigirLimite } from '../../utils/rateLimit.ts'
import { analizarTexto, ErrorIA, MENSAJE_IA_NO_DISPONIBLE_TEXTO } from '../../utils/ia.ts'

export const onRequestPost: Handler = async ({ request, env, data }) => {
  const sesion = exigirSesion(data.sesion)
  const { descripcion } = await leerBody(request, analizarTextoSchema)
  await exigirLimite(env, `analizar-texto:u:${sesion.usuarioId}`, 30, 86400, 'Has alcanzado el límite de 30 descripciones diarias. Puedes buscar el alimento o añadirlo a mano.')
  try {
    const { proveedor, modelo, resultado } = await analizarTexto(env, descripcion)
    return json({ ok: true, proveedor, modelo, resultado })
  } catch (e) {
    if (e instanceof ErrorIA) {
      return error(503, MENSAJE_IA_NO_DISPONIBLE_TEXTO, { codigo: 'ia_no_disponible' })
    }
    throw e
  }
}
