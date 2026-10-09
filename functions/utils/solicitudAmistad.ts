/**
 * Alta de una fila en `amistades`.
 * La sesión es el solicitante. Un id del cuerpo no elige quién envía.
 * Estados reales: pendiente | aceptada | rechazada. No hay `friendships.status`.
 */
import type { Env } from './env.ts'
import { HttpError } from './response.ts'

export interface EnlaceAmistad {
  id: string
  estado: 'pendiente' | 'aceptada'
  /** 201 si inserta; 200 si acepta una solicitud que ya había llegado. */
  status: 200 | 201
}

export async function enlazarAmistad(env: Env, solicitanteId: string, receptorId: string): Promise<EnlaceAmistad> {
  if (solicitanteId === receptorId) throw new HttpError(400, 'No puedes enviarte una solicitud a ti mismo.')

  const existente = await env.DB.prepare(
    `SELECT id, solicitante_id, receptor_id, estado FROM amistades
     WHERE (solicitante_id = ?1 AND receptor_id = ?2) OR (solicitante_id = ?2 AND receptor_id = ?1)`,
  )
    .bind(solicitanteId, receptorId)
    .first<{ id: string; solicitante_id: string; receptor_id: string; estado: string }>()

  if (existente?.estado === 'aceptada') throw new HttpError(409, 'Ya sois amigos.')
  if (existente && existente.estado === 'pendiente' && existente.receptor_id === solicitanteId) {
    await env.DB.prepare(`UPDATE amistades SET estado = 'aceptada' WHERE id = ?1 AND receptor_id = ?2 AND estado = 'pendiente'`)
      .bind(existente.id, solicitanteId)
      .run()
    return { id: existente.id, estado: 'aceptada', status: 200 }
  }
  if (existente?.estado === 'pendiente') throw new HttpError(409, 'La solicitud ya está enviada.')

  if (existente?.estado === 'rechazada' && existente.solicitante_id === solicitanteId) {
    await env.DB.prepare(`UPDATE amistades SET estado = 'pendiente', creado_en = datetime('now') WHERE id = ?1 AND solicitante_id = ?2`)
      .bind(existente.id, solicitanteId)
      .run()
    return { id: existente.id, estado: 'pendiente', status: 200 }
  }
  if (existente?.estado === 'rechazada') {
    await env.DB.prepare('DELETE FROM amistades WHERE id = ?1').bind(existente.id).run()
  }

  const id = crypto.randomUUID()
  try {
    await env.DB.prepare(`INSERT INTO amistades (id, solicitante_id, receptor_id, estado) VALUES (?1, ?2, ?3, 'pendiente')`)
      .bind(id, solicitanteId, receptorId)
      .run()
  } catch (e) {
    if (e instanceof Error && /UNIQUE/i.test(e.message)) throw new HttpError(409, 'La solicitud ya está enviada.')
    throw e
  }
  return { id, estado: 'pendiente', status: 201 }
}
