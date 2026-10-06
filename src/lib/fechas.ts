/** Fechas locales del dispositivo en formato 'YYYY-MM-DD'. */
export function aISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${dia}`
}

export const hoyISO = () => aISO(new Date())

export function desdeISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number) as [number, number, number]
  return new Date(y, m - 1, d)
}

export function sumarDias(s: string, n: number): string {
  const d = desdeISO(s)
  d.setDate(d.getDate() + n)
  return aISO(d)
}

/** Lunes..domingo de la semana que contiene `s`. */
export function semanaDe(s: string): string[] {
  const d = desdeISO(s)
  const lunes = sumarDias(s, -((d.getDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i))
}

const fmtLargo = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
const fmtCorto = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' })
export const fechaLarga = (s: string) => fmtLargo.format(desdeISO(s))
export const fechaCorta = (s: string) => fmtCorto.format(desdeISO(s)).replace('.', '')
export const INICIAL_DIA = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

/** Tipo de comida sugerido según la hora. */
export function tipoPorHora(h = new Date().getHours()): 'desayuno' | 'comida' | 'cena' | 'snack' {
  if (h >= 5 && h < 11) return 'desayuno'
  if (h >= 12 && h < 16) return 'comida'
  if (h >= 20 || h < 2) return 'cena'
  return 'snack'
}
