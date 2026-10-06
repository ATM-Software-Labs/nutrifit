/**
 * Adaptadores de los proveedores de IA. Cada uno traduce una PeticionIA a su API
 * y devuelve el contenido crudo (texto u objeto); el parseo/validación es común.
 *
 *   gemini      Google Gemini API (visión + texto)        GEMINI_API_KEY
 *   groq        Groq, API compatible con OpenAI           GROQ_API_KEY
 *   trujillo    Trujillo AI (ai.trujillomingorance.com)   TRUJILLO_AI_TOKEN + IA_TRUJILLO=1
 *   workers-ai  Cloudflare Workers AI (binding AI)        siempre disponible en Pages
 *
 * Modelos por defecto verificados en oct-2026 (ver docs/BACKEND.md §5); todos
 * configurables por variable de entorno (listas separadas por comas).
 */
import type { Env } from './env.ts'
import { conTimeout, dataUrl, base64, ErrorProveedor, errorHttp, errorRed, type IdProveedor, type PeticionIA, type ProveedorIA } from './iaCadena.ts'

/** "a, b,,c" → ['a','b','c'] (solo caracteres válidos en ids de modelo). */
export function listaModelos(valor: string | undefined, porDefecto: readonly string[]): string[] {
  const l = (valor ?? '')
    .split(',')
    .map((s) => s.trim().replace(/[^a-z0-9@/._:\-]/gi, ''))
    .filter(Boolean)
  const out = l.length ? l : [...porDefecto]
  return out.filter((m, i) => out.indexOf(m) === i)
}

// ------------------------------------------------------------------- Gemini
export const GEMINI_MODELOS = ['gemini-3.8-flash', 'gemini-3.5-flash-lite'] as const

interface RespuestaGemini {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[]
  promptFeedback?: { blockReason?: string }
}

async function llamarGemini(env: Env, modelo: string, p: PeticionIA, signal: AbortSignal, conThinking = true): Promise<unknown> {
  const parts: unknown[] = []
  if (p.imagen) parts.push({ inline_data: { mime_type: p.imagen.mime, data: base64(p.imagen.bytes) } })
  parts.push({ text: p.usuario })
  const body = {
    systemInstruction: { parts: [{ text: p.sistema }] },
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseMimeType: 'application/json',
      ...(p.esquemaGemini ? { responseSchema: p.esquemaGemini } : {}),
      temperature: p.temperatura ?? 0.2,
      maxOutputTokens: Math.max(2048, (p.maxTokens ?? 1200) * 2),
      // Gemini 3.x piensa por defecto (medium): para esto basta "low" y es mucho más rápido.
      ...(conThinking ? { thinkingConfig: { thinkingLevel: 'low' } } : {}),
    },
  }
  let res: Response
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY ?? '' },
      body: JSON.stringify(body),
      signal,
    })
  } catch (e) {
    throw errorRed('gemini', e)
  }
  if (res.status === 400 && conThinking) {
    // Algún modelo (p. ej. un flash-lite antiguo) no admite thinkingLevel: se repite sin él.
    const txt = await res.text().catch(() => '')
    if (/thinking/i.test(txt)) return llamarGemini(env, modelo, p, signal, false)
    throw new ErrorProveedor('http', 'gemini HTTP 400', { estado: 400 })
  }
  if (!res.ok) throw errorHttp('gemini', res)
  const data = (await res.json()) as RespuestaGemini
  const c = data.candidates?.[0]
  const texto = c?.content?.parts?.filter((x) => !x.thought).map((x) => x.text ?? '').join('') ?? ''
  if (!texto.trim()) throw new ErrorProveedor('vacia', `gemini sin contenido (${c?.finishReason ?? data.promptFeedback?.blockReason ?? 'vacío'})`)
  return texto
}

export const gemini: ProveedorIA = {
  id: 'gemini',
  noDisponible: (env) => (env.GEMINI_API_KEY ? null : 'sin_clave'),
  // GEMINI_MODEL (principal) y GEMINI_MODEL_RESPALDO (puede ser una lista) dentro del mismo proveedor.
  modelos: (env) => listaModelos(`${env.GEMINI_MODEL || GEMINI_MODELOS[0]},${env.GEMINI_MODEL_RESPALDO || GEMINI_MODELOS[1]}`, GEMINI_MODELOS),
  aceptaMime: () => true, // jpeg, png, webp, heic
  llamar: (env, modelo, p, signal) => llamarGemini(env, modelo, p, signal),
}

// ------------------------------------------------------- OpenAI-compatible
interface RespuestaOpenAI {
  choices?: { message?: { content?: unknown }; finish_reason?: string }[]
  model?: string
}

export function mensajesOpenAI(p: PeticionIA): unknown[] {
  return [
    { role: 'system', content: p.sistema },
    p.imagen
      ? { role: 'user', content: [{ type: 'text', text: p.usuario }, { type: 'image_url', image_url: { url: dataUrl(p.imagen) } }] }
      : { role: 'user', content: p.usuario },
  ]
}

export function contenidoOpenAI(proveedor: string, data: RespuestaOpenAI): unknown {
  const c = data.choices?.[0]?.message?.content
  if (typeof c === 'string' && c.trim()) return c
  if (Array.isArray(c)) {
    const t = c.map((x) => (typeof x === 'string' ? x : ((x as { text?: string })?.text ?? ''))).join('')
    if (t.trim()) return t
  }
  if (c && typeof c === 'object') return c
  throw new ErrorProveedor('vacia', `${proveedor} sin contenido (${data.choices?.[0]?.finish_reason ?? 'vacío'})`)
}

// --------------------------------------------------------------------- Groq
export const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
export const GROQ_MODELOS_VISION = ['qwen/qwen3.8-27b'] as const
export const GROQ_MODELOS_TEXTO = ['openai/gpt-oss-20b', 'openai/gpt-oss-120b'] as const

/** Parámetros de razonamiento: lo mínimo posible (JSON directo y rápido). */
export function razonamientoGroq(modelo: string): Record<string, unknown> {
  if (modelo.startsWith('openai/gpt-oss')) return { reasoning_effort: 'low', include_reasoning: false }
  if (modelo.startsWith('qwen/')) return { reasoning_effort: 'none', reasoning_format: 'hidden' }
  return {}
}

export const groq: ProveedorIA = {
  id: 'groq',
  noDisponible: (env) => (env.GROQ_API_KEY ? null : 'sin_clave'),
  modelos: (env, conImagen) => (conImagen ? listaModelos(env.GROQ_MODELOS_VISION, GROQ_MODELOS_VISION) : listaModelos(env.GROQ_MODELOS_TEXTO, GROQ_MODELOS_TEXTO)),
  aceptaMime: () => true, // jpeg, png, webp, gif (data URL ≤ 4 MB)
  async llamar(env, modelo, p, signal) {
    let res: Response
    try {
      res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${env.GROQ_API_KEY ?? ''}` },
        body: JSON.stringify({
          model: modelo,
          messages: mensajesOpenAI(p),
          response_format: { type: 'json_object' },
          temperature: p.temperatura ?? 0.2,
          max_completion_tokens: p.maxTokens ?? 1200,
          stream: false,
          ...razonamientoGroq(modelo),
        }),
        signal,
      })
    } catch (e) {
      throw errorRed('groq', e)
    }
    if (res.status === 400) {
      // En modo JSON, si la salida no valida Groq devuelve 400 con `failed_generation`:
      // a menudo es JSON casi correcto que nuestro extractor sí sabe limpiar.
      const err = (await res.json().catch(() => null)) as { error?: { code?: string; failed_generation?: string } } | null
      if (err?.error?.code === 'json_validate_failed' && err.error.failed_generation) return err.error.failed_generation
      throw new ErrorProveedor('http', `groq HTTP 400${err?.error?.code ? ' ' + err.error.code.slice(0, 40) : ''}`, { estado: 400 })
    }
    if (!res.ok) throw errorHttp('groq', res)
    return contenidoOpenAI('groq', (await res.json()) as RespuestaOpenAI)
  },
}

// ----------------------------------------------------------------- Trujillo
/**
 * Trujillo AI (Worker «groq-discord-bot», ai.trujillomingorance.com). Hoy solo expone
 * /api/chat (SSE, persona de chat, cuota por IP): no sirve para JSON servidor a servidor.
 * Este cliente habla con el endpoint PROPUESTO (docs/BACKEND.md §5.3):
 *   POST {TRUJILLO_AI_URL}/api/v1/chat/completions   Authorization: Bearer TRUJILLO_AI_TOKEN
 *   cuerpo y respuesta compatibles con OpenAI (sin streaming, response_format json_object).
 * Desactivado salvo IA_TRUJILLO=1 y TRUJILLO_AI_TOKEN. Si existe el Service Binding
 * TRUJILLO_AI (mismo account), se usa en lugar de Internet.
 */
export const TRUJILLO_URL_POR_DEFECTO = 'https://ai.trujillomingorance.com'

export const trujillo: ProveedorIA = {
  id: 'trujillo',
  noDisponible: (env) => (!/^(1|true|si|sí|on)$/i.test(env.IA_TRUJILLO ?? '') ? 'desactivado' : env.TRUJILLO_AI_TOKEN ? null : 'sin_token'),
  modelos: (env, conImagen) => listaModelos(conImagen ? env.TRUJILLO_AI_MODELO_VISION : env.TRUJILLO_AI_MODELO_TEXTO, [conImagen ? 'auto-vision' : 'auto-texto']),
  aceptaMime: () => true,
  async llamar(env, modelo, p, signal) {
    const base = (env.TRUJILLO_AI_URL || TRUJILLO_URL_POR_DEFECTO).replace(/\/+$/, '')
    const init: RequestInit = {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${env.TRUJILLO_AI_TOKEN ?? ''}`, 'x-cliente': 'nutrifit' },
      body: JSON.stringify({
        model: modelo,
        messages: mensajesOpenAI(p),
        response_format: { type: 'json_object' },
        temperature: p.temperatura ?? 0.2,
        max_tokens: p.maxTokens ?? 1200,
        stream: false,
      }),
      signal,
    }
    const url = `${base}/api/v1/chat/completions`
    let res: Response
    try {
      res = env.TRUJILLO_AI ? await env.TRUJILLO_AI.fetch(url, init) : await fetch(url, init)
    } catch (e) {
      throw errorRed('trujillo', e)
    }
    if (!res.ok) throw errorHttp('trujillo', res)
    return contenidoOpenAI('trujillo', (await res.json()) as RespuestaOpenAI)
  },
}

// --------------------------------------------------------------- Workers AI
/**
 * Visión SIN licencia que aceptar (llama-3.2-11b-vision exige el «agree» de Meta y
 * queda fuera). Probados con una foto real el 06-oct-2026 (ver docs/BACKEND.md §5).
 */
export const WORKERS_AI_MODELOS_VISION = [
  '@cf/qwen/qwen3.8-27b',
  '@cf/google/gemma-4-26b-a4b-it',
  '@cf/meta/llama-4-scout-17b-16e-instruct',
  '@cf/llava-hf/llava-1.5-7b-hf',
] as const
export const WORKERS_AI_MODELOS_TEXTO = [
  '@cf/google/gemma-4-26b-a4b-it',
  '@cf/qwen/qwen3.8-27b',
  '@cf/mistralai/mistral-small-3.1-24b-instruct',
] as const

/** Cuerpo de env.AI.run según la familia del modelo. */
export function cuerpoWorkersAI(modelo: string, p: PeticionIA): Record<string, unknown> {
  const maxTokens = p.maxTokens ?? 1200
  const temperature = p.temperatura ?? 0.2
  if (modelo.includes('llava')) {
    // Image-to-Text clásico: bytes + prompt único, sin modo JSON.
    return { image: Array.from(p.imagen?.bytes ?? []), prompt: `${p.sistema}\n\n${p.usuario}`, max_tokens: maxTokens, temperature }
  }
  if (modelo.includes('llama-3.2') && p.imagen) {
    return { messages: [{ role: 'system', content: p.sistema }, { role: 'user', content: p.usuario }], image: Array.from(p.imagen.bytes), max_tokens: maxTokens, temperature }
  }
  return {
    messages: mensajesOpenAI(p),
    max_tokens: maxTokens,
    temperature,
    response_format: { type: 'json_object' },
    // Gemma 4 y Qwen 3.x razonan por defecto (lento): aquí no hace falta. Mistral rechaza el campo.
    ...(modelo.includes('gemma') || modelo.includes('qwen') ? { chat_template_kwargs: { enable_thinking: false } } : {}),
  }
}

/** Contenido útil de una respuesta de Workers AI (OpenAI `choices`, clásico `response` o llava `description`). */
export function contenidoWorkersAI(out: unknown): unknown {
  const o = (out ?? {}) as { response?: unknown; description?: unknown; choices?: { message?: { content?: unknown } }[] }
  const c = o.choices?.[0]?.message?.content
  if (typeof c === 'string' && c.trim()) return c
  if (c && typeof c === 'object') return c
  const r = o.response ?? o.description
  if (r === undefined || r === null || r === '') throw new ErrorProveedor('vacia', 'workers-ai sin contenido')
  return r
}

/** Errores de env.AI.run → ErrorProveedor (licencia, capacidad, límites…). */
export function errorWorkersAI(modelo: string, e: unknown): ErrorProveedor {
  if (e instanceof ErrorProveedor) return e
  const msg = e instanceof Error ? e.message : String(e)
  if (/agree|licen[cs]e|5016/i.test(msg)) return new ErrorProveedor('licencia', `${modelo} exige aceptar licencia`)
  if (/3040|capacity|429|too many|rate/i.test(msg)) return new ErrorProveedor('http', `${modelo} sin capacidad`, { estado: 429, reintentable: true })
  if (/5007|no such model|not found/i.test(msg)) return new ErrorProveedor('config', `${modelo} no existe`, { estado: 404 })
  if (/3043|\b5\d\d\b|internal|unavailable|timed? ?out/i.test(msg)) return new ErrorProveedor('http', `${modelo} error interno`, { estado: 500, reintentable: true })
  return new ErrorProveedor('http', `${modelo}: ${msg.slice(0, 100)}`, { estado: 400 })
}

export const workersAI: ProveedorIA = {
  id: 'workers-ai',
  noDisponible: (env) => (env.AI ? null : 'sin_binding'),
  modelos: (env, conImagen) =>
    conImagen ? listaModelos(env.WORKERS_AI_MODELOS_VISION, WORKERS_AI_MODELOS_VISION) : listaModelos(env.WORKERS_AI_MODELOS_TEXTO, WORKERS_AI_MODELOS_TEXTO),
  aceptaMime: () => true,
  async llamar(env, modelo, p, signal) {
    const ai = env.AI as unknown as { run: (m: string, i: unknown) => Promise<unknown> }
    let out: unknown
    try {
      out = await conTimeout(ai.run(modelo, cuerpoWorkersAI(modelo, p)), signal)
    } catch (e) {
      throw errorWorkersAI(modelo, e)
    }
    return contenidoWorkersAI(out)
  },
}

export const PROVEEDORES: Record<IdProveedor, ProveedorIA> = { gemini, groq, trujillo, 'workers-ai': workersAI }
