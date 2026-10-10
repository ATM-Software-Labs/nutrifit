import type { Handler } from '../../utils/env.ts'
import { error, json } from '../../utils/response.ts'
import { leerBody } from '../../utils/http.ts'
import { dispositivoSchema } from '../../utils/schemas.ts'
import { exigirIdentidad } from '../../utils/identidad.ts'

export const onRequestGet: Handler = async ({ env, data }) => {
  const sesion = await exigirIdentidad(env, data.sesion)
  const idActual = sesion.via === 'cookie' ? sesion.sidHash : sesion.jtiHash;
  try {
    const { results } = await env.DB.prepare(
      `SELECT sid_hash as id, 'Web' as dispositivo, 'Navegador' as navegador, null as ip, COALESCE(visto_en, creado_en) as ultimo_acceso
       FROM sesiones_web
       WHERE usuario_id = ?1 AND (revocado_en IS NULL)
       UNION ALL
       SELECT jti_hash as id, 'Móvil' as dispositivo, 'App Android' as navegador, null as ip, creado_en as ultimo_acceso
       FROM tokens_app
       WHERE usuario_id = ?1 AND (revocado_en IS NULL)
       ORDER BY ultimo_acceso DESC LIMIT 50`
    )
      .bind(sesion.usuarioId)
      .all()
      
    const dispositivos = (results ?? []).map((row: any) => ({
      ...row,
      es_actual: row.id === idActual
    }))
    
    return json({ ok: true, dispositivos })
  } catch {
    return json({ ok: true, dispositivos: [] })
  }
}

export const onRequestDelete: Handler = async ({ request, env, data }) => {
  const sesion = await exigirIdentidad(env, data.sesion)
  const { sesionId } = await leerBody(request, dispositivoSchema)
  try {
    const ahora = Math.floor(Date.now() / 1000)
    
    if (sesionId === 'ALL_OTHER') {
        const idActual = sesion.via === 'cookie' ? sesion.sidHash : sesion.jtiHash;
        await env.DB.prepare('UPDATE sesiones_web SET revocado_en = ?1 WHERE usuario_id = ?2 AND sid_hash != ?3').bind(ahora, sesion.usuarioId, idActual).run();
        await env.DB.prepare('UPDATE tokens_app SET revocado_en = ?1 WHERE usuario_id = ?2 AND jti_hash != ?3').bind(ahora, sesion.usuarioId, idActual).run();
        return json({ ok: true })
    }
    
    const rWeb = await env.DB.prepare('UPDATE sesiones_web SET revocado_en = ?1 WHERE sid_hash = ?2 AND usuario_id = ?3')
      .bind(ahora, sesionId, sesion.usuarioId)
      .run()
    
    let changes = rWeb.meta.changes

    if (!changes) {
      const rApp = await env.DB.prepare('UPDATE tokens_app SET revocado_en = ?1 WHERE jti_hash = ?2 AND usuario_id = ?3')
        .bind(ahora, sesionId, sesion.usuarioId)
        .run()
      changes = rApp.meta.changes
    }

    if (!changes) return error(404, 'Sesión no encontrada.')
    return json({ ok: true })
  } catch {
    return error(404, 'Sesión no encontrada.')
  }
}
