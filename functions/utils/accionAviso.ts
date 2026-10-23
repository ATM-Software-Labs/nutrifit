/**
 * Avisos de franja con botones ("Ya comí", "Saltar hoy", "Apuntar").
 * El service worker contesta los botones sin abrir la app: POST /api/recordatorios/accion con un
 * token firmado que viaja en el propio aviso (usuario, franja, fecha). Así funciona aunque la
 * cookie de sesión haya caducado, y el token no sirve para nada más que marcar esa franja ese día.
 */
import { firmar, verificarFirma } from './crypto.ts'
import type { Aviso } from './webpush.ts'

export const PROPOSITO_ACCION = 'aviso-franja-v1'
/** Vale hasta el día siguiente (un aviso guardado en el reloj o el móvil se puede contestar tarde). */
const VIGENCIA_S = 36 * 3600

export interface TokenAccion { u: string; f: string; d: string; exp: number }

export function tokenAccion(secreto: string, usuarioId: string, franja: string, fecha: string, ahora = Date.now()): Promise<string> {
  return firmar(secreto, PROPOSITO_ACCION, { u: usuarioId, f: franja, d: fecha, exp: Math.floor(ahora / 1000) + VIGENCIA_S } satisfies TokenAccion)
}

export async function leerTokenAccion(secreto: string, token: string, ahora = Date.now()): Promise<TokenAccion | null> {
  const t = await verificarFirma<TokenAccion>(secreto, PROPOSITO_ACCION, token)
  if (!t || typeof t.u !== 'string' || typeof t.f !== 'string' || typeof t.d !== 'string' || typeof t.exp !== 'number') return null
  return t.exp * 1000 >= ahora ? t : null
}

export const ACCIONES_FRANJA = [
  // Chrome (Android, escritorio y Wear OS) enseña como mucho 2 botones: van primero los que no abren la app.
  // Tocar la notificación hace lo mismo que "Apuntar".
  { accion: 'hecho', titulo: 'Ya comí' },
  { accion: 'saltar', titulo: 'Saltar hoy' },
  { accion: 'apuntar', titulo: 'Apuntar' },
]

/** Carga útil corta, apta para reloj: una etiqueta por comida, vibración y botones. */
export function avisoFranja(a: { titulo: string; cuerpo: string; url: string; franja: string; fecha: string; token?: string | null }): Aviso {
  return {
    titulo: a.titulo,
    cuerpo: a.cuerpo,
    url: a.url,
    etiqueta: `comida-${a.franja}`,
    renotificar: true,
    vibrar: [200, 100, 200],
    acciones: ACCIONES_FRANJA,
    datos: { franja: a.franja, fecha: a.fecha, ...(a.token ? { t: a.token } : {}) },
  }
}
