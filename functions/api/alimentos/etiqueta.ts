/**
 * POST /api/alimentos/etiqueta — foto de la tabla nutricional → valores por
 * 100 g (y por ración si aparece) validados con reglas de coherencia.
 * Middleware: sesión previa + Turnstile + 20/min por IP. Aquí: 20 lecturas/día
 * por usuario. El usuario revisa y edita SIEMPRE antes de guardar.
 */
import type { Handler } from '../../utils/env.ts'
import { error, json } from '../../utils/response.ts'
import { exigirSesion } from '../../utils/session.ts'
import { exigirLimite } from '../../utils/rateLimit.ts'
import { ErrorIA, leerEtiqueta } from '../../utils/ia.ts'
import { leerImagen } from '../../utils/imagenSubida.ts'
import { normalizarEtiqueta } from '../../utils/etiqueta.ts'

export const onRequestPost: Handler = async ({ request, env, data }) => {
  const sesion = exigirSesion(data.sesion)
  const img = await leerImagen(request)
  await exigirLimite(env, `etiqueta:u:${sesion.usuarioId}`, 20, 86400, 'Has alcanzado el límite de 20 etiquetas al día. Puedes escribir los valores a mano.')
  try {
    const { proveedor, modelo, resultado } = await leerEtiqueta(env, img, normalizarEtiqueta)
    return json({ ok: true, proveedor, modelo, etiqueta: resultado })
  } catch (e) {
    if (e instanceof ErrorIA && e.definitivo) {
      return error(422, 'La foto no parece una tabla de información nutricional. Fotografía la parte de atrás del envase, donde pone «Información nutricional».', {
        codigo: 'no_es_tabla',
      })
    }
    if (e instanceof ErrorIA) {
      return error(422, 'No hemos podido leer la tabla nutricional. Haz la foto de cerca, recta y con buena luz, o escribe los valores a mano.', {
        codigo: 'etiqueta_no_legible',
      })
    }
    throw e
  }
}
