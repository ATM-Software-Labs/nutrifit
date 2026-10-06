/** Utilidades de fechas (día natural en Europa/Madrid por defecto). */
export const ZONA_POR_DEFECTO = 'Europe/Madrid'

/** Fecha de hoy 'YYYY-MM-DD' en la zona indicada. */
export function hoy(zona = ZONA_POR_DEFECTO, ahora = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora)
}

export const ahoraEpoch = () => Math.floor(Date.now() / 1000)
