/** POST /api/comidas/guardar — inserta una comida del usuario de la sesión. */
import type { Handler } from '../../utils/env.ts'
import { json } from '../../utils/response.ts'
import { leerBody } from '../../utils/http.ts'
import { comidaGuardarSchema } from '../../utils/schemas.ts'
import { exigirSesion } from '../../utils/session.ts'
import { exigirLimite } from '../../utils/rateLimit.ts'
import { emojiComida, esEmojiValido } from '../../../src/lib/miniaturaComida.ts'
import { aComidaApi, type FilaComida } from '../../utils/comidas.ts'
import { registrarPlatoEnSegundoPlano } from '../../utils/supabase.ts'

export const onRequestPost: Handler = async ({ request, env, data, waitUntil }) => {
  const sesion = exigirSesion(data.sesion)
  const c = await leerBody(request, comidaGuardarSchema, 64 * 1024)
  await exigirLimite(env, `guardar:u:${sesion.usuarioId}`, 300, 86400)
  // Privacidad: nunca se guarda una foto ni un enlace a ella, aunque el cliente lo envíe.
  c.imagen_url = null

  const fila = await env.DB.prepare(
    `INSERT INTO diario_comidas
       (id, usuario_id, tipo_comida, descripcion, calorias, proteinas, carbohidratos, grasas, ingredientes_json, imagen_url, fecha, emoji, cantidad, unidad, envase, porcion, codigo_barras)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)
     RETURNING *`,
  )
    .bind(
      crypto.randomUUID(),
      sesion.usuarioId,
      c.tipo_comida,
      c.descripcion,
      c.calorias,
      c.proteinas,
      c.carbohidratos,
      c.grasas,
      c.ingredientes?.length ? JSON.stringify(c.ingredientes) : null,
      c.imagen_url ?? null,
      c.fecha,
      esEmojiValido(c.emoji) ? c.emoji : emojiComida(c),
      c.cantidad ?? null,
      c.unidad ?? null,
      c.envase ?? null,
      c.porcion ?? null,
      c.codigo_barras ?? null,
    )
    .first<FilaComida>()

  // Catálogo de platos (Supabase): solo los reconocidos por IA o escaneados, con el nombre
  // normalizado y sin usuario, fecha ni notas. Nunca bloquea la respuesta.
  if (fila && (c.ingredientes?.length || c.codigo_barras)) {
    registrarPlatoEnSegundoPlano({ env, waitUntil }, {
      descripcion: fila.descripcion, emoji: fila.emoji, calorias: fila.calorias, proteinas: fila.proteinas,
      carbohidratos: fila.carbohidratos, grasas: fila.grasas, cantidad: fila.cantidad, unidad: fila.unidad,
    })
  }
  return json({ ok: true, comida: fila ? aComidaApi(fila) : null }, { status: 201 })
}
