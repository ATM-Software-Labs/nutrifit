/** Gasto local de una sesión. No llama a la red. */
export type TipoSesion = 'fuerza' | 'cardio'
export type IntensidadSesion = 'baja' | 'media' | 'alta'

const KCAL_POR_MIN: Record<TipoSesion, Record<IntensidadSesion, number>> = {
  fuerza: { baja: 4, media: 6.5, alta: 8.5 },
  cardio: { baja: 6, media: 9, alta: 12 },
}

export function caloriasSesion(tipo: TipoSesion, intensidad: IntensidadSesion, minutos: number): number {
  const min = Number.isFinite(minutos) ? Math.max(0, minutos) : 0
  return Math.round(KCAL_POR_MIN[tipo][intensidad] * min)
}

export interface SesionAgua {
  tipo: string
  minutos: number | null
}

/** +500 ml si hay fuerza hoy, +10 ml por minuto de cardio. */
export function extraAguaMl(sesiones: SesionAgua[]): number {
  let fuerza = false
  let cardio = 0
  for (const s of sesiones) {
    const min = s.minutos ?? 0
    if (s.tipo === 'fuerza') fuerza = true
    if (s.tipo === 'cardio' && min > 0) cardio += min
  }
  return (fuerza ? 500 : 0) + cardio * 10
}

/** Base = último peso × 35 ml. El ejercicio se suma aparte. */
export function metaAgua(pesoKg: number | null | undefined, sesiones: SesionAgua[]): { base: number; ejercicio: number; objetivo: number } {
  const peso = typeof pesoKg === 'number' && Number.isFinite(pesoKg) && pesoKg > 0 ? pesoKg : 0
  const base = Math.round(peso * 35)
  const ejercicio = extraAguaMl(sesiones)
  return { base, ejercicio, objetivo: base + ejercicio }
}
