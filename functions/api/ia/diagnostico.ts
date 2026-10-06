/**
 * POST /api/ia/diagnostico — prueba en vivo de la cadena de IA (solo operadores).
 *
 * Solo existe si el secreto IA_DIAG_TOKEN está configurado (pensado para el
 * entorno PREVIEW) y la cabecera X-Diag-Token coincide; si no, 404. No consume
 * el límite diario de usuarios ni guarda nada. Ignora el circuit breaker.
 *
 *   { "tarea": "plato" | "texto" | "etiqueta", "imagen"?: base64, "texto"?: string,
 *     "proveedor"?: "gemini"|"groq"|"trujillo"|"workers-ai", "modelo"?: string }
 *   → { ok, proveedor, modelo, ms, intentos, resultado } | { ok:false, intentos }
 *
 * GET devuelve qué proveedores están configurados (nombres, nunca valores).
 */
import { z } from 'zod'
import type { Env, Handler } from '../../utils/env.ts'
import { error, json } from '../../utils/response.ts'
import { leerBody } from '../../utils/http.ts'
import { timingSafeEqual } from '../../utils/crypto.ts'
import { detectarMime, ejecutarIA, ErrorIA, parsearPlato, PROMPT_ETIQUETA, PROMPT_SISTEMA, PROMPT_SISTEMA_TEXTO, RESPONSE_SCHEMA, textoUsuario } from '../../utils/ia.ts'
import { extraerJson } from '../../utils/iaParseo.ts'
import { leerConfig, ordenProveedores, type PeticionIA } from '../../utils/iaCadena.ts'
import { PROVEEDORES } from '../../utils/iaProveedores.ts'

function autorizado(env: Env, request: Request): boolean {
  const esperado = env.IA_DIAG_TOKEN
  const dado = request.headers.get('X-Diag-Token') ?? ''
  return !!esperado && esperado.length >= 24 && timingSafeEqual(dado, esperado)
}

const cuerpo = z.object({
  tarea: z.enum(['plato', 'texto', 'etiqueta']).default('plato'),
  imagen: z.string().max(2_200_000).optional(),
  texto: z.string().min(2).max(300).optional(),
  proveedor: z.string().max(20).optional(),
  modelo: z
    .string()
    .max(80)
    .regex(/^[a-z0-9@/._:\-]+$/i)
    .optional(),
})

function decodificar(b64: string): Uint8Array {
  const bin = atob(b64.replace(/^data:image\/[a-z+]+;base64,/i, '').replace(/\s+/g, ''))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export const onRequestGet: Handler = async ({ request, env }) => {
  if (!autorizado(env, request)) return error(404, 'No encontrado.')
  const cfg = leerConfig(env)
  return json({
    ok: true,
    orden: cfg.orden,
    timeoutMs: cfg.timeoutMs,
    presupuestoMs: cfg.presupuestoMs,
    proveedores: cfg.orden.map((id) => ({
      id,
      disponible: PROVEEDORES[id].noDisponible(env) ?? 'si',
      vision: PROVEEDORES[id].modelos(env, true),
      texto: PROVEEDORES[id].modelos(env, false),
    })),
  })
}

export const onRequestPost: Handler = async ({ request, env }) => {
  if (!autorizado(env, request)) return error(404, 'No encontrado.')
  const b = await leerBody(request, cuerpo, 2_300_000)
  let p: PeticionIA
  let parsear: (c: unknown) => unknown = parsearPlato
  if (b.tarea === 'texto') {
    if (!b.texto) return error(400, 'Falta "texto".')
    p = { tarea: 'diagnostico', sistema: PROMPT_SISTEMA_TEXTO, usuario: textoUsuario(b.texto), esquemaGemini: RESPONSE_SCHEMA, maxTokens: 1200 }
  } else {
    if (!b.imagen) return error(400, 'Falta "imagen".')
    const bytes = decodificar(b.imagen)
    const mime = detectarMime(bytes)
    if (!mime) return error(415, 'Formato no soportado.')
    p =
      b.tarea === 'etiqueta'
        ? { tarea: 'diagnostico', sistema: PROMPT_ETIQUETA, usuario: 'Extrae la tabla nutricional y devuelve el JSON.', imagen: { bytes, mime }, maxTokens: 900 }
        : { tarea: 'diagnostico', sistema: PROMPT_SISTEMA, usuario: 'Analiza esta comida y devuelve el JSON.', imagen: { bytes, mime }, esquemaGemini: RESPONSE_SCHEMA, maxTokens: 1200 }
    if (b.tarea === 'etiqueta') parsear = (c) => extraerJson(c)
  }
  const soloProveedor = b.proveedor ? ordenProveedores(b.proveedor)[0] : undefined
  try {
    const r = await ejecutarIA(env, p, parsear, { soloProveedor, soloModelo: b.modelo, ignorarCircuito: true })
    return json({ ok: true, proveedor: r.proveedor, modelo: r.modelo, ms: r.ms, intentos: r.intentos, resultado: r.resultado })
  } catch (e) {
    if (e instanceof ErrorIA) return json({ ok: false, definitivo: e.definitivo, error: e.message, intentos: e.intentos }, { status: 503 })
    throw e
  }
}
