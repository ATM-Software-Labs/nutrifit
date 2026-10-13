/** Fusión de preferencias de cantidades (gana lo más reciente por producto). */
export interface EntradaCantidad { cantidad: number; clave?: string; t: number }
export interface PrefCantidades { aguaTodasBebidas: boolean; aguaT: number; cantidades: Record<string, EntradaCantidad> }

export const MAX_PRODUCTOS = 200

export function fusionar(a: PrefCantidades, b: PrefCantidades): PrefCantidades {
  const cantidades: Record<string, EntradaCantidad> = { ...a.cantidades }
  for (const [k, v] of Object.entries(b.cantidades)) if (!cantidades[k] || cantidades[k]!.t < v.t) cantidades[k] = v
  const recientes = Object.entries(cantidades).sort((x, y) => y[1].t - x[1].t).slice(0, MAX_PRODUCTOS)
  const agua = b.aguaT > a.aguaT ? b : a
  return { aguaTodasBebidas: agua.aguaTodasBebidas, aguaT: agua.aguaT, cantidades: Object.fromEntries(recientes) }
}
