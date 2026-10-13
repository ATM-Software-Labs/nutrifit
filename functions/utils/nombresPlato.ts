/** Sugerencias de nombre para una comida: prompt, saneado y respaldo local. */
import { sanitizarTextoLibre } from './sanitizar.ts'

export function promptNombres(descripcion: string, ingredientes: string[]): string {
  const ing = ingredientes.length ? ` Ingredientes: ${ingredientes.slice(0, 12).join(', ')}.` : ''
  return `Propón 5 nombres cortos (máximo 40 caracteres), claros y apetecibles, en español de España, para esta comida: "${descripcion.slice(0, 200)}".${ing} Sin marcas inventadas, sin emojis, sin comillas. Responde solo JSON: {"nombres":["...","..."]}`
}

/** Acepta {"nombres":[…]}, una lista o texto con una opción por línea. */
export function limpiarNombres(salida: unknown, original: string): string[] {
  let lista: unknown = salida
  if (typeof salida === 'string') {
    try { lista = JSON.parse(salida.replace(/^```(?:json)?|```$/g, '').trim()) } catch { lista = salida.split('\n') }
  }
  if (lista && typeof lista === 'object' && !Array.isArray(lista)) lista = (lista as { nombres?: unknown }).nombres
  if (!Array.isArray(lista)) return []
  const vistos = new Set([original.trim().toLowerCase()])
  const out: string[] = []
  for (const x of lista) {
    if (typeof x !== 'string') continue
    const n = recortar(sanitizarTextoLibre(x.replace(/^[-*\d.)\s"]+|["\s]+$/g, '')))
    if (n.length < 3 || vistos.has(n.toLowerCase())) continue
    vistos.add(n.toLowerCase())
    out.push(n.charAt(0).toUpperCase() + n.slice(1))
    if (out.length === 5) break
  }
  return out
}

/** Sin IA: combinaciones sencillas a partir del nombre y los ingredientes. */
export function nombresLocales(descripcion: string, ingredientes: string[]): string[] {
  const base = descripcion.trim().replace(/\s+/g, ' ')
  const principal = (ingredientes[0] || base.split(/[,(]/)[0] || base).trim()
  const cands = [base, /\bcaser[oa]\b/i.test(principal) ? null : `${principal} casero`, /^plato\b/i.test(principal) ? null : `Plato de ${principal.toLowerCase()}`, ingredientes.length > 1 ? `${ingredientes[0]} con ${ingredientes[1]!.toLowerCase()}` : null, /^raci[oó]n\b/i.test(principal) ? null : `Ración de ${principal.toLowerCase()}`]
  return [...new Set(cands.filter((c): c is string => !!c).map((c) => recortar(c)).filter(Boolean))].slice(0, 5)
}

/** Corta a 40 caracteres sin partir palabras. */
export function recortar(t: string, max = 40): string {
  const s = t.trim()
  if (s.length <= max) return s
  const corte = s.slice(0, max + 1).lastIndexOf(' ')
  return (corte > 10 ? s.slice(0, corte) : s.slice(0, max)).replace(/[\s,;:.-]+$/, '')
}
