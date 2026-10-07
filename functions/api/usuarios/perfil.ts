/**
 * POST /api/usuarios/perfil — guarda el onboarding + objetivos calculados.
 * Requiere sesión y Turnstile (middleware). La primera vez envía el email de
 * bienvenida en segundo plano (waitUntil, no bloquea ni falla la petición).
 */
import type { Handler } from '../../utils/env.ts'
import { json } from '../../utils/response.ts'
import { leerBody } from '../../utils/http.ts'
import { perfilSchema } from '../../utils/schemas.ts'
import { exigirSesion } from '../../utils/session.ts'
import { COLUMNAS_USUARIO, obtenerUsuario, type Usuario } from '../../utils/usuarios.ts'
import { enviarBienvenida } from '../../utils/brevo.ts'
import { hoy } from '../../utils/fechas.ts'
import { calcularMacros } from '../../../src/lib/macros.ts'
import { camposPerfil, conEtag, hashContenido, hashEnviado, noModificado } from '../../utils/contenidoHash.ts'
import { aplazarHistoricoPeso, tursoConfigurado } from '../../utils/turso.ts'

export const onRequestPost: Handler = async (ctx) => {
  const { request, env, data } = ctx
  const sesion = exigirSesion(data.sesion)
  const p = await leerBody(request, perfilSchema)
  const plan = calcularMacros(p)

  const previo = await obtenerUsuario(env, sesion.usuarioId)
  if (!previo) return json({ ok: false, error: 'Usuario no encontrado.' }, { status: 404 })

  const hash = await hashContenido(
    camposPerfil({
      nombre: p.nombre,
      edad: p.edad,
      sexo: p.sexo,
      peso: p.peso,
      altura: p.altura,
      actividad: p.actividad,
      objetivo: p.objetivo,
      calorias: plan.calorias,
      proteinas: plan.proteinas,
      carbohidratos: plan.carbohidratos,
      grasas: plan.grasas,
    }),
  )
  const hashPrevio =
    previo.nombre != null && previo.edad != null && previo.sexo && previo.peso_kg != null && previo.altura_cm != null && previo.nivel_actividad && previo.objetivo && previo.meta_calorias != null
      ? await hashContenido(
          camposPerfil({
            nombre: previo.nombre,
            edad: previo.edad,
            sexo: previo.sexo,
            peso: previo.peso_kg,
            altura: previo.altura_cm,
            actividad: previo.nivel_actividad,
            objetivo: previo.objetivo,
            calorias: previo.meta_calorias,
            proteinas: previo.meta_proteinas ?? 0,
            carbohidratos: previo.meta_carbs ?? 0,
            grasas: previo.meta_grasas ?? 0,
          }),
        )
      : null
  if (hashPrevio === hash) {
    if (hashEnviado(request) === hash) return noModificado(hash)
    return json({ ok: true, usuario: previo, plan }, { headers: conEtag(hash) })
  }

  const fechaPeso = hoy()
  const historicoExterno = tursoConfigurado(env)
  const escrituras = [
    env.DB.prepare(
      `UPDATE usuarios SET nombre = ?1, edad = ?2, sexo = ?3, peso_kg = ?4, altura_cm = ?5,
              nivel_actividad = ?6, objetivo = ?7, meta_calorias = ?8, meta_proteinas = ?9,
              meta_carbs = ?10, meta_grasas = ?11, actualizado_en = CURRENT_TIMESTAMP
        WHERE id = ?12
        RETURNING ${COLUMNAS_USUARIO}`,
    ).bind(p.nombre, p.edad, p.sexo, p.peso, p.altura, p.actividad, p.objetivo, plan.calorias, plan.proteinas, plan.carbohidratos, plan.grasas, sesion.usuarioId),
  ]
  if (!historicoExterno) {
    escrituras.push(
      env.DB.prepare(
        `INSERT INTO historico_peso (id, usuario_id, peso, fecha) VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT (usuario_id, fecha) DO UPDATE SET peso = excluded.peso
         WHERE historico_peso.peso IS NOT excluded.peso`,
      ).bind(crypto.randomUUID(), sesion.usuarioId, p.peso, fechaPeso),
    )
  }
  const [actualizado] = await env.DB.batch<Usuario>(escrituras)
  if (historicoExterno) aplazarHistoricoPeso(ctx, { id: crypto.randomUUID(), usuarioId: sesion.usuarioId, peso: p.peso, fecha: fechaPeso })
  const usuario = actualizado?.results[0]

  if (previo.meta_calorias === null) {
    ctx.waitUntil(enviarBienvenida(env, previo.email, p.nombre, plan))
  }
  return json({ ok: true, usuario, plan }, { headers: conEtag(hash) })
}
