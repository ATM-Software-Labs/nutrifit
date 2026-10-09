/** Lectura segura de peticiones: tamaño, tipo de contenido y validación Zod. */
import type { z } from 'zod'
import { HttpError } from './response.ts'
import { formatearErrores, uuid } from './schemas.ts'

export const MAX_JSON_BYTES = 32 * 1024

export function ipCliente(request: Request): string {
  return request.headers.get('CF-Connecting-IP') ?? request.headers.get('X-Real-IP') ?? '0.0.0.0'
}

export function validar<S extends z.ZodType>(schema: S, datos: unknown): z.infer<S> {
  const r = schema.safeParse(datos)
  if (!r.success) throw new HttpError(400, 'Datos no válidos.', { detalles: formatearErrores(r.error) })
  return r.data
}

/** Lee el cuerpo como texto respetando un límite de bytes (no se fía de Content-Length). */
export async function leerTextoLimitado(request: Request, maxBytes: number): Promise<string> {
  const declarado = Number(request.headers.get('content-length') ?? 0)
  if (declarado > maxBytes) throw new HttpError(413, 'La petición es demasiado grande.')
  if (!request.body) return ''
  const reader = request.body.getReader()
  const trozos: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      throw new HttpError(413, 'La petición es demasiado grande.')
    }
    trozos.push(value)
  }
  const buf = new Uint8Array(total)
  let off = 0
  for (const t of trozos) {
    buf.set(t, off)
    off += t.byteLength
  }
  return new TextDecoder().decode(buf)
}

export async function leerJson(request: Request, maxBytes = MAX_JSON_BYTES): Promise<unknown> {
  const ct = request.headers.get('content-type') ?? ''
  if (!ct.toLowerCase().startsWith('application/json')) {
    throw new HttpError(415, 'El cuerpo debe ser application/json.')
  }
  const texto = await leerTextoLimitado(request, maxBytes)
  let datos: unknown
  try {
    datos = JSON.parse(texto)
  } catch {
    throw new HttpError(400, 'JSON mal formado.')
  }
  rechazarFormaPeligrosa(datos)
  return datos
}

/** Tope de anidación y de listas, y rechazo de claves que pisan el prototipo. */
function rechazarFormaPeligrosa(valor: unknown, profundidad = 0): void {
  if (profundidad > 8) throw new HttpError(400, 'JSON demasiado anidado.')
  if (Array.isArray(valor)) {
    if (valor.length > 100) throw new HttpError(400, 'JSON demasiado grande.')
    for (const v of valor) rechazarFormaPeligrosa(v, profundidad + 1)
    return
  }
  if (!valor || typeof valor !== 'object') return
  const obj = valor as Record<string, unknown>
  const claves = Object.keys(obj)
  if (claves.length > 40) throw new HttpError(400, 'JSON demasiado grande.')
  for (const k of claves) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') throw new HttpError(400, 'JSON no válido.')
    rechazarFormaPeligrosa(obj[k], profundidad + 1)
  }
}

/** Lee y valida el cuerpo JSON con un esquema Zod. */
export async function leerBody<S extends z.ZodType>(request: Request, schema: S, maxBytes = MAX_JSON_BYTES) {
  return validar(schema, await leerJson(request, maxBytes))
}

/** Convierte URLSearchParams en objeto plano para validarlo con Zod. */
export const queryObj = (url: string) => Object.fromEntries(new URL(url).searchParams)

/** Id de ruta (`:id`). Un valor que no sea UUID no llega a SQL. */
export function idRuta(id: string | string[] | undefined): string {
  return validar(uuid, Array.isArray(id) ? id[0] : id)
}
