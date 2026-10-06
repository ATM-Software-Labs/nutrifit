/**
 * Comprobaciones de sentido común sobre el análisis de un plato (foto o texto),
 * DESPUÉS de la validación Zod de iaParseo.ts. Módulo puro (testeable con node --test).
 *
 *  - Rellena las kcal de un ingrediente que no las trae (Atwater: 4P + 4C + 9G).
 *  - Si los totales no cuadran con la suma de ingredientes, manda la suma.
 *  - kcal ≈ 4P + 4C + 9G (tolerancia ±max(40 kcal, 20 %)): fuera de ella se corrigen
 *    las kcal; si la diferencia es absurda (×2) la respuesta se rechaza.
 *    Las bebidas alcohólicas se excluyen (el alcohol aporta 7 kcal/g sin macro).
 *  - Ingredientes imposibles (macros > gramos, > 9,5 kcal/g) o raciones
 *    inverosímiles (> 3 kg o > 4000 kcal en una comida) → rechazo.
 * Un rechazo lanza ErrorParseo: la cadena prueba el siguiente modelo/proveedor.
 */
import { ErrorParseo, type ResultadoAnalisis } from './iaParseo.ts'

const r1 = (n: number) => Math.round(n * 10) / 10
export const kcalAtwater = (m: { proteinas: number; carbohidratos: number; grasas: number }) => 4 * m.proteinas + 4 * m.carbohidratos + 9 * m.grasas

const ALCOHOL = /cerveza|vino|whisk|ron\b|ginebra|\bgin\b|vodka|licor|sidra|cava|champ[aá]n|vermut|tequila|sangr[ií]a|c[oó]ctel|mojito|calimocho|tinto de verano|brandy|co[ñn]ac|pacharán|orujo|alcohol/i

export const MAX_GRAMOS_COMIDA = 3000
export const MAX_KCAL_COMIDA = 4000

export function revisarAnalisis(r: ResultadoAnalisis): ResultadoAnalisis {
  const ingredientes = r.ingredientes.map((i) => ({ ...i }))
  for (const i of ingredientes) {
    const conMacros = i.proteinas !== undefined && i.carbohidratos !== undefined && i.grasas !== undefined
    if (conMacros) {
      const g = (i.proteinas ?? 0) + (i.carbohidratos ?? 0) + (i.grasas ?? 0)
      if (i.gramos > 0 && g > i.gramos * 1.05 + 1) throw new ErrorParseo(`Ingrediente incoherente: ${r1(g)} g de macros en ${i.gramos} g`)
      if (i.calorias === undefined) i.calorias = r1(kcalAtwater(i as { proteinas: number; carbohidratos: number; grasas: number }))
    }
    if (i.calorias !== undefined && i.gramos > 0 && i.calorias > i.gramos * 9.5 + 5) throw new ErrorParseo(`Ingrediente incoherente: ${i.calorias} kcal en ${i.gramos} g`)
  }

  const out: ResultadoAnalisis = { ...r, ingredientes }
  const gramosTotales = ingredientes.reduce((a, i) => a + i.gramos, 0)
  if (gramosTotales > MAX_GRAMOS_COMIDA) throw new ErrorParseo(`Ración inverosímil: ${Math.round(gramosTotales)} g`)

  // Totales = suma de ingredientes (si todos traen el macro y difieren > 10 %).
  if (ingredientes.length) {
    for (const m of ['calorias', 'proteinas', 'carbohidratos', 'grasas'] as const) {
      if (!ingredientes.every((i) => i[m] !== undefined)) continue
      const suma = r1(ingredientes.reduce((a, i) => a + (i[m] ?? 0), 0))
      if (Math.abs(suma - out[m]) > Math.max(m === 'calorias' ? 15 : 2, 0.1 * Math.max(suma, out[m]))) out[m] = suma
    }
  }

  const alcohol = ALCOHOL.test(out.nombre_plato) || ingredientes.some((i) => ALCOHOL.test(i.nombre))
  const atw = kcalAtwater(out)
  if (!alcohol && atw > 0) {
    const tol = Math.max(40, 0.2 * Math.max(out.calorias, atw))
    if (Math.abs(out.calorias - atw) > tol) {
      const ratio = out.calorias / atw
      if (out.calorias > 50 && (ratio < 0.5 || ratio > 2)) {
        throw new ErrorParseo(`Calorías incoherentes: ${Math.round(out.calorias)} kcal vs ≈ ${Math.round(atw)} kcal por macros`)
      }
      out.calorias = r1(atw)
    }
  }
  if (out.calorias > MAX_KCAL_COMIDA) throw new ErrorParseo(`Ración inverosímil: ${Math.round(out.calorias)} kcal`)
  return out
}
