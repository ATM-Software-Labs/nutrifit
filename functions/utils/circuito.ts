/**
 * Circuit breaker por gateway de visión. El estado vive en el isolate
 * (contadores y una marca de tiempo): no guarda fotos, usuarios ni respuestas.
 * Cada isolate tiene el suyo; no es un corte global de toda la cuenta.
 *
 * Cerrado → se llama. Tras `umbral` fallos de transporte seguidos, abierto
 * durante `enfriamientoMs` (la petición ni espera el timeout). Al vencer,
 * una sola sonda (medio abierto). Si falla, se vuelve a abrir.
 */

export interface OpcionesCircuito {
  umbral?: number
  enfriamientoMs?: number
  ahora?: () => number
}

interface Estado {
  fallos: number
  abiertoHasta: number
  sonda: boolean
}

export function crearCircuitos(opciones: OpcionesCircuito = {}) {
  const umbral = opciones.umbral ?? 3
  const enfriamientoMs = opciones.enfriamientoMs ?? 30_000
  const ahora = opciones.ahora ?? (() => Date.now())
  const estados = new Map<string, Estado>()

  function estado(id: string): Estado {
    let e = estados.get(id)
    if (!e) {
      e = { fallos: 0, abiertoHasta: 0, sonda: false }
      estados.set(id, e)
    }
    return e
  }

  return {
    /** false: circuito abierto, no llamar al gateway. */
    permite(id: string): boolean {
      const e = estados.get(id)
      if (!e) return true
      const t = ahora()
      if (e.abiertoHasta > t) return false
      if (e.sonda) return false
      if (e.abiertoHasta !== 0 && e.abiertoHasta <= t) {
        e.abiertoHasta = 0
        e.sonda = true
        return true
      }
      return true
    },
    exito(id: string): void {
      estados.delete(id)
    },
    /** La sonda no llegó a probar el gateway (p. ej. falta la clave). No cuenta como fallo. */
    liberarSonda(id: string): void {
      const e = estados.get(id)
      if (e?.sonda) e.sonda = false
    },
    fallo(id: string): void {
      const e = estado(id)
      const eraSonda = e.sonda
      e.sonda = false
      e.fallos += 1
      if (eraSonda || e.fallos >= umbral) {
        e.abiertoHasta = ahora() + enfriamientoMs
        e.fallos = 0
      }
    },
    reiniciar(): void {
      estados.clear()
    },
  }
}

export const UMBRAL_CIRCUITO = 3
export const ENFRIAMIENTO_CIRCUITO_MS = 30_000

/** Gateways de la foto del plato. Texto y etiqueta no lo consultan. */
export const circuitosVision = crearCircuitos({
  umbral: UMBRAL_CIRCUITO,
  enfriamientoMs: ENFRIAMIENTO_CIRCUITO_MS,
})
