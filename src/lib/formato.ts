const nf0 = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 })
const nf1 = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 })
/** 2278 → "2278" · 12345 → "12.345" (sin separador para 4 cifras, como RAE). */
export const entero = (n: number) => nf0.format(Math.round(n))
export const decimal = (n: number) => nf1.format(n)
export const r1 = (n: number) => Math.round(n * 10) / 10
export const litros = (ml: number) => `${nf1.format(ml / 1000)} L`
