/**
 * GET /api/exportar?tipo=comidas|peso|agua&desde=…&hasta=…   (máx. 366 días)
 * Descarga CSV (separador «;», coma decimal, UTF-8 con BOM) con
 * Content-Disposition: attachment. Límite: 30 / hora por usuario.
 */
import type { Handler } from '../utils/env.ts'
import { queryObj, validar } from '../utils/http.ts'
import { exportarQuery } from '../utils/schemas.ts'
import { exigirSesion } from '../utils/session.ts'
import { exigirLimite } from '../utils/rateLimit.ts'
import { nombreArchivo } from '../utils/csv.ts'
import { csvExportacion } from '../utils/exportar.ts'

export const onRequestGet: Handler = async ({ request, env, data }) => {
  const sesion = exigirSesion(data.sesion)
  await exigirLimite(env, `exportar:u:${sesion.usuarioId}`, 30, 3600, 'Has hecho demasiadas exportaciones. Espera un rato.')
  const { tipo, desde, hasta } = validar(exportarQuery, queryObj(request.url))
  const csv = await csvExportacion(env, sesion.usuarioId, tipo, desde, hasta)
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nombreArchivo(tipo, desde, hasta)}"`,
      'Cache-Control': 'no-store',
    },
  })
}
