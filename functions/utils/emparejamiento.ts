/**
 * Login en el PC con QR (emparejamiento con un móvil que ya tiene sesión).
 *
 *   PC                                   servidor                         móvil (con sesión)
 *   secreto = 32 bytes aleatorios ──►  crear: id (256 bits), código corto
 *   (se queda en el navegador)          guarda SHA-256(id), SHA-256(secreto)
 *   QR = https://…/vincular#id   ◄──   {id, codigo, expira}
 *                                                                        escanea → info(id) → «¿Iniciar
 *                                                                        sesión en este ordenador?» +
 *                                                                        dispositivo, lugar, hora, código
 *                                       aprobar(id, usuario) ◄────────── Aprobar
 *   estado(id, secreto) cada 2 s ──►   si aprobado: consumir (1 vez) → cookie de sesión NUEVA para el PC
 *
 * Quien solo ve el QR (id) no puede recoger la sesión: hace falta el secreto,
 * que nunca sale del navegador del PC hasta la consulta de estado.
 */
import type { Env } from './env.ts'
import { base64urlEncode, bytesAleatorios, sha256Hex, timingSafeEqual } from './crypto.ts'

export const DURACION_QR = 120 // s para aprobar
export const MARGEN_RECOGIDA = 60 // s extra para que el PC recoja la sesión ya aprobada

const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sin 0/O ni 1/I

export function codigoCorto(): string {
  const b = bytesAleatorios(4)
  return Array.from(b, (x) => ALFABETO_CODIGO[x % 32]).join('') // 32 divide 256: sin sesgo
}

/** «Chrome · Windows» a partir del User-Agent (aproximado, sin versión exacta). */
export function describirDispositivo(ua: string | null): string {
  if (!ua) return 'Navegador desconocido'
  const nav = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/.test(ua)
      ? 'Opera'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Chrome\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : 'Navegador'
  const so = /Windows/.test(ua)
    ? 'Windows'
    : /Android/.test(ua)
      ? 'Android'
      : /iPhone|iPad|iPod/.test(ua)
        ? 'iOS'
        : /Mac OS X|Macintosh/.test(ua)
          ? 'macOS'
          : /CrOS/.test(ua)
            ? 'ChromeOS'
            : /Linux/.test(ua)
              ? 'Linux'
              : 'otro sistema'
  return `${nav} · ${so}`
}

/** «Madrid, ES» a partir de request.cf (aproximado; null si no hay datos). */
export function describirUbicacion(cf: unknown): string | null {
  const c = (cf ?? {}) as { city?: unknown; country?: unknown }
  const ciudad = typeof c.city === 'string' ? c.city.replace(/[<>]/g, '').slice(0, 60) : ''
  const pais = typeof c.country === 'string' && /^[A-Z]{2}$/.test(c.country) ? c.country : ''
  const s = [ciudad, pais].filter(Boolean).join(', ')
  return s || null
}

export interface NuevoEmparejamiento {
  id: string
  codigo: string
  expira: number
}

export async function crearEmparejamiento(
  env: Env,
  secretoHash: string,
  dispositivo: string,
  ubicacion: string | null,
  ahora = Math.floor(Date.now() / 1000),
): Promise<NuevoEmparejamiento> {
  const id = base64urlEncode(bytesAleatorios(32))
  const codigo = codigoCorto()
  const expira = ahora + DURACION_QR
  await env.DB.prepare(
    'INSERT INTO emparejamientos_qr (id_hash, secreto_hash, codigo, dispositivo, ubicacion, expira_en, creado_en) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)',
  )
    .bind(await sha256Hex(id), secretoHash.toLowerCase(), codigo, dispositivo, ubicacion, expira, ahora)
    .run()
  return { id, codigo, expira }
}

interface FilaEmparejamiento {
  secreto_hash: string
  codigo: string
  estado: 'pendiente' | 'aprobado' | 'rechazado' | 'consumido'
  dispositivo: string | null
  ubicacion: string | null
  usuario_id: string | null
  expira_en: number
  aprobado_en: number | null
  creado_en: number
}

const leer = async (env: Env, id: string) =>
  env.DB.prepare(
    'SELECT secreto_hash, codigo, estado, dispositivo, ubicacion, usuario_id, expira_en, aprobado_en, creado_en FROM emparejamientos_qr WHERE id_hash = ?1',
  )
    .bind(await sha256Hex(id))
    .first<FilaEmparejamiento>()

/** Datos para la pantalla de confirmación del móvil (null si no existe o ha caducado). */
export async function infoEmparejamiento(env: Env, id: string, ahora = Math.floor(Date.now() / 1000)) {
  const f = await leer(env, id)
  if (!f || f.expira_en <= ahora || f.estado !== 'pendiente') return null
  return { codigo: f.codigo, dispositivo: f.dispositivo ?? 'Navegador desconocido', ubicacion: f.ubicacion, creado_en: f.creado_en, expira_en: f.expira_en }
}

/** Aprobar / rechazar desde el móvil. Solo una vez y solo si sigue pendiente y vigente. */
export async function decidirEmparejamiento(env: Env, id: string, usuarioId: string, aprobar: boolean, ahora = Math.floor(Date.now() / 1000)): Promise<boolean> {
  const fila = await env.DB.prepare(
    `UPDATE emparejamientos_qr SET estado = ?1, usuario_id = ?2, aprobado_en = ?3
      WHERE id_hash = ?4 AND estado = 'pendiente' AND expira_en > ?3
      RETURNING estado`,
  )
    .bind(aprobar ? 'aprobado' : 'rechazado', aprobar ? usuarioId : null, ahora, await sha256Hex(id))
    .first<{ estado: string }>()
  return !!fila
}

export type EstadoEmparejamiento =
  | { estado: 'pendiente'; expira: number }
  | { estado: 'aprobado'; usuarioId: string }
  | { estado: 'rechazado' | 'caducado' | 'invalido' }

/**
 * Consulta del PC. Exige el secreto (tiempo constante). Si está aprobado lo
 * marca 'consumido' de forma atómica: la sesión solo se entrega una vez.
 */
export async function estadoEmparejamiento(env: Env, id: string, secreto: string, ahora = Math.floor(Date.now() / 1000)): Promise<EstadoEmparejamiento> {
  const f = await leer(env, id)
  if (!f) return { estado: 'invalido' }
  if (!timingSafeEqual(await sha256Hex(secreto), f.secreto_hash)) return { estado: 'invalido' }
  if (f.estado === 'rechazado') return { estado: 'rechazado' }
  if (f.estado === 'consumido') return { estado: 'invalido' }
  if (f.estado === 'pendiente') return f.expira_en > ahora ? { estado: 'pendiente', expira: f.expira_en } : { estado: 'caducado' }
  // aprobado → recoger una sola vez dentro del margen
  const consumido = await env.DB.prepare(
    `UPDATE emparejamientos_qr SET estado = 'consumido'
      WHERE id_hash = ?1 AND estado = 'aprobado' AND aprobado_en + ?2 > ?3
      RETURNING usuario_id`,
  )
    .bind(await sha256Hex(id), MARGEN_RECOGIDA, ahora)
    .first<{ usuario_id: string }>()
  return consumido?.usuario_id ? { estado: 'aprobado', usuarioId: consumido.usuario_id } : { estado: 'caducado' }
}
