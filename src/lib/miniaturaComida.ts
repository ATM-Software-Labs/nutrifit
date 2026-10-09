/** Emoji cuando el plato no tiene foto: el macro que más kcal aporta. */
export function emojiMacro(m: { proteinas: number; carbohidratos: number; grasas: number }): string {
  const p = m.proteinas * 4
  const c = m.carbohidratos * 4
  const g = m.grasas * 9
  if (p >= c && p >= g) return '🥩'
  if (c >= g) return '🍚'
  return '🥑'
}
