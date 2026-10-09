/**
 * Texto libre que puede acabar en pantalla.
 * Se guardan caracteres planos (sin etiquetas). Al responder, `escaparHtml`
 * convierte `& < > " '` para que un innerHTML accidental no ejecute nada.
 * El nombre de usuario no pasa por aquí: solo cumple `^[a-zA-Z0-9_]{3,20}$`.
 */

const ETIQUETA = /<[^>]*>/g

/** Quita controles y etiquetas. No codifica entidades: eso es `escaparHtml`. */
export function sanitizarTextoLibre(valor: string): string {
  return valor
    .replace(/[\u0000-\u001F\u007F]+/g, ' ')
    .replace(ETIQUETA, '')
    .replace(/[<>]/g, '')
    .replace(/[ \t\f\v]+/g, ' ')
    .trim()
}

/**
 * Texto que se va a pegar en el prompt. Además de las etiquetas, quita
 * marcas de rol y órdenes típicas de inyección. No es comida: no hace falta.
 */
export function sanitizarContextoModelo(valor: string, max = 300): string {
  return sanitizarTextoLibre(valor)
    .replace(/\b(system|assistant|developer)\s*:/gi, ' ')
    .replace(/ignore\s+(all\s+|any\s+)?(previous|prior|above)\s+instructions/gi, ' ')
    .replace(/olvida\s+(las\s+|todas\s+las\s+)?instrucciones(\s+anteriores)?/gi, ' ')
    .replace(/[`{}]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim()
    .slice(0, max)
}

/** Codifica el texto para un contexto HTML. `&` va primero. */
export function escaparHtml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Invierte `escaparHtml` para pintarlo en un nodo de texto (React). */
export function desescaparHtml(valor: string): string {
  return valor
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
}

export function presentarTexto(valor: string | null | undefined): string | null {
  if (valor == null) return null
  const limpio = sanitizarTextoLibre(valor)
  if (!limpio) return null
  return escaparHtml(limpio)
}
