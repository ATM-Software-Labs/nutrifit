/** Decide si toca el aviso «¿Compartes tu día?» (puro, para tests). */
const aMin = (h: string) => { const [a, b] = h.split(':').map(Number); return (a ?? 0) * 60 + (b || 0) }
export function tocaAvisoCompartir({ ahora, numComidas, cierre, canalApp, descartado }: { ahora: Date; numComidas: number; cierre: string | null; canalApp: boolean; descartado: boolean }) {
  if (descartado || !canalApp || numComidas < 1) return false
  // Una hora antes del aviso de cierre (o 21:00 sin cierre), nunca antes de las 18:00 ni después de las 22:00.
  const desde = Math.min(cierre ? aMin(cierre) - 60 : 21 * 60, 22 * 60)
  return ahora.getHours() * 60 + ahora.getMinutes() >= Math.max(desde, 18 * 60)
}
