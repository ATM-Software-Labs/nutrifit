/**
 * POST /api/comidas/sugerir-nombres { descripcion, ingredientes? } → { nombres: string[] }
 * 3–5 nombres cortos en español. Groq (gpt-oss-20b) → Gemini → Workers AI → sugerencias locales.
 */
import type { Handler } from '../../utils/env.ts'
import { json } from '../../utils/response.ts'
import { leerBody } from '../../utils/http.ts'
import { sugerirNombresSchema } from '../../utils/schemas.ts'
import { exigirSesion } from '../../utils/session.ts'
import { exigirLimite } from '../../utils/rateLimit.ts'
import { GEMINI_MODELO_POR_DEFECTO, MODELOS_TEXTO_WORKERS_AI, MODELO_GROQ_RAPIDO, URL_GROQ, contenidoWorkersAI, extrasGroq } from '../../utils/ia.ts'
import { limpiarNombres, nombresLocales, promptNombres } from '../../utils/nombresPlato.ts'

export const onRequestPost: Handler = async ({ request, env, data }) => {
  const sesion = exigirSesion(data.sesion)
  const c = await leerBody(request, sugerirNombresSchema, 8 * 1024)
  await exigirLimite(env, `nombres:u:${sesion.usuarioId}`, 60, 3600)
  const prompt = promptNombres(c.descripcion, c.ingredientes ?? [])
  if (env.GROQ_API_KEY) {
    try {
      const r = await fetch(URL_GROQ, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${env.GROQ_API_KEY}` },
        body: JSON.stringify({
          model: MODELO_GROQ_RAPIDO,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          response_format: { type: 'json_object' },
          ...extrasGroq(MODELO_GROQ_RAPIDO, 200),
        }),
        signal: AbortSignal.timeout(8000),
      })
      if (r.ok) {
        const n = limpiarNombres(contenidoWorkersAI(await r.json()), c.descripcion)
        if (n.length >= 3) return json({ ok: true, nombres: n })
      }
    } catch (e) { console.warn('[nombres] Groq', e) }
  }
  if (env.GEMINI_API_KEY) {
    try {
      const modelo = env.GEMINI_MODEL || GEMINI_MODELO_POR_DEFECTO
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, responseMimeType: 'application/json', maxOutputTokens: 200 } }),
        signal: AbortSignal.timeout(8000),
      })
      if (r.ok) {
        const d = (await r.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
        const n = limpiarNombres(d.candidates?.[0]?.content?.parts?.[0]?.text, c.descripcion)
        if (n.length >= 3) return json({ ok: true, nombres: n })
      }
    } catch (e) { console.warn('[nombres] Gemini', e) }
  }
  if (env.AI) {
    try {
      const ai = env.AI as unknown as { run: (m: string, i: unknown) => Promise<unknown> }
      const out = await Promise.race([
        ai.run(MODELOS_TEXTO_WORKERS_AI[0], { messages: [{ role: 'user', content: prompt }], max_tokens: 200, temperature: 0.7, response_format: { type: 'json_object' }, chat_template_kwargs: { enable_thinking: false } }),
        new Promise((_, ko) => setTimeout(() => ko(new Error('tiempo')), 8000)),
      ])
      const n = limpiarNombres(contenidoWorkersAI(out), c.descripcion)
      if (n.length >= 3) return json({ ok: true, nombres: n })
    } catch (e) { console.warn('[nombres] Workers AI', e) }
  }
  return json({ ok: true, nombres: nombresLocales(c.descripcion, c.ingredientes ?? []), local: true })
}
