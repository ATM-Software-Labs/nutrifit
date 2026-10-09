/**
 * Portabilidad y supresión. El volcado solo incluye al usuario de la sesión.
 * El borrado vacía nutrifit-db (hijos y luego la fila de usuarios) y, si Turso
 * está configurado, el historial de peso que ya se hubiera copiado allí.
 */
import type { Env } from './env.ts'
import { aComidaApi, type FilaComida } from './comidas.ts'
import { listarPesos, olvidarPesosRemotos } from './turso.ts'
import { obtenerUsuario } from './usuarios.ts'

export interface VolcadoCuenta {
  exportado_en: string
  perfil: Record<string, unknown>
  diario_comidas: ReturnType<typeof aComidaApi>[]
  historico_peso: { id: string | null; peso: number; fecha: string; creado_en: string | null }[]
  registro_agua: { fecha: string; ml: number; actualizado_en: string }[]
  entrenamientos: Record<string, unknown>[]
}

export async function volcadoCuenta(env: Env, usuarioId: string): Promise<VolcadoCuenta | null> {
  const perfil = await obtenerUsuario(env, usuarioId)
  if (!perfil) return null
  const [comidas, agua, pesosLocal, entrenos, pesos] = await Promise.all([
    env.DB.prepare('SELECT * FROM diario_comidas WHERE usuario_id = ?1 ORDER BY fecha, creado_en').bind(usuarioId).all<FilaComida>(),
    env.DB.prepare('SELECT fecha, ml, actualizado_en FROM registro_agua WHERE usuario_id = ?1 ORDER BY fecha').bind(usuarioId).all<{ fecha: string; ml: number; actualizado_en: string }>(),
    env.DB.prepare('SELECT id, peso, fecha, creado_en FROM historico_peso WHERE usuario_id = ?1 ORDER BY fecha').bind(usuarioId).all<{ id: string; peso: number; fecha: string; creado_en: string }>(),
    env.DB.prepare(
      `SELECT id, tipo, nombre, minutos, duracion_min, intensidad, calorias, origen, fecha, creado_en
         FROM entrenamientos WHERE usuario_id = ?1 ORDER BY fecha, creado_en`,
    ).bind(usuarioId).all<Record<string, unknown>>(),
    listarPesos(env, usuarioId, '1970-01-01', '2999-12-31'),
  ])
  const porFecha = new Map<string, VolcadoCuenta['historico_peso'][number]>(
    (pesosLocal.results ?? []).map((f) => [f.fecha, { id: f.id, peso: f.peso, fecha: f.fecha, creado_en: f.creado_en }]),
  )
  for (const fila of pesos) {
    const previa = porFecha.get(fila.fecha)
    porFecha.set(fila.fecha, { id: previa?.id ?? null, peso: fila.peso, fecha: fila.fecha, creado_en: previa?.creado_en ?? null })
  }
  return {
    exportado_en: new Date().toISOString(),
    perfil: { ...perfil },
    diario_comidas: (comidas.results ?? []).map(aComidaApi),
    historico_peso: [...porFecha.values()].sort((a, b) => a.fecha.localeCompare(b.fecha)),
    registro_agua: agua.results ?? [],
    entrenamientos: entrenos.results ?? [],
  }
}

/** Borra integraciones_apps solo si la tabla y la columna de usuario existen. */
async function borrarIntegraciones(env: Env, usuarioId: string): Promise<void> {
  const tabla = await env.DB.prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'integraciones_apps'").first<{ ok: number }>()
  if (!tabla) return
  const info = await env.DB.prepare('PRAGMA table_info(integraciones_apps)').all<{ name: string }>()
  if (!(info.results ?? []).some((c) => c.name.toLowerCase() === 'usuario_id')) return
  await env.DB.prepare('DELETE FROM integraciones_apps WHERE usuario_id = ?1').bind(usuarioId).run()
}

const POR_USUARIO = [
  'DELETE FROM archivos_usuario WHERE usuario_id = ?1',
  'DELETE FROM amistades WHERE solicitante_id = ?1 OR receptor_id = ?1',
  'DELETE FROM comidas_frecuentes WHERE usuario_id = ?1',
  'DELETE FROM entrenamientos WHERE usuario_id = ?1',
  'DELETE FROM diario_comidas WHERE usuario_id = ?1',
  'DELETE FROM historico_peso WHERE usuario_id = ?1',
  'DELETE FROM registro_agua WHERE usuario_id = ?1',
  'DELETE FROM productos_usuario WHERE usuario_id = ?1',
  'DELETE FROM sesiones_web WHERE usuario_id = ?1',
  'DELETE FROM tokens_app WHERE usuario_id = ?1',
  'DELETE FROM emparejamientos_qr WHERE usuario_id = ?1',
  'DELETE FROM usuarios WHERE id = ?1',
] as const

/** true si la fila de usuarios desaparece. No toca a otras cuentas. */
export async function borrarCuenta(env: Env, usuarioId: string, email: string): Promise<boolean> {
  const existe = await env.DB.prepare('SELECT 1 AS ok FROM usuarios WHERE id = ?1').bind(usuarioId).first<{ ok: number }>()
  if (!existe) return false
  await olvidarPesosRemotos(env, usuarioId)
  await borrarIntegraciones(env, usuarioId)
  await env.DB.batch([
    ...POR_USUARIO.map((sql) => env.DB.prepare(sql).bind(usuarioId)),
    env.DB.prepare('DELETE FROM codigos_login WHERE email = ?1 COLLATE NOCASE').bind(email),
    env.DB.prepare('DELETE FROM magic_tokens WHERE email = ?1 COLLATE NOCASE').bind(email),
    env.DB.prepare('DELETE FROM rate_limits WHERE clave LIKE ?1').bind(`%:${usuarioId}`),
  ])
  const queda = await env.DB.prepare('SELECT 1 AS ok FROM usuarios WHERE id = ?1').bind(usuarioId).first<{ ok: number }>()
  return !queda
}
