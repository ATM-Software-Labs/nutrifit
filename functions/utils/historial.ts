/**
 * Agregación del historial (módulo PURO, testeable con node --test).
 * Rellena con ceros los días sin registros para que las gráficas tengan el
 * eje completo. Las medias se calculan sobre los días CON comidas registradas.
 */
export const MAX_DIAS_HISTORIAL = 400

export interface Totales {
  calorias: number
  proteinas: number
  carbohidratos: number
  grasas: number
}

export interface DiaHistorial extends Totales {
  fecha: string
  num_comidas: number
  agua_ml: number
  peso: number | null
}

export interface Historial {
  desde: string
  hasta: string
  dias: DiaHistorial[]
  metas: Totales | null
  medias: (Totales & { agua_ml: number }) | null
  dias_con_registro: number
  /** Días con comidas cuyas kcal quedan dentro de ±10 % de la meta. */
  dias_en_objetivo: number
  peso: { inicio: number; fin: number; cambio: number } | null
}

const r1 = (n: number) => Math.round(n * 10) / 10

/** Días 'YYYY-MM-DD' de desde a hasta (ambos incluidos), en UTC para evitar saltos de horario. */
export function diasEntre(desde: string, hasta: string): string[] {
  const [y1, m1, d1] = desde.split('-').map(Number) as [number, number, number]
  const [y2, m2, d2] = hasta.split('-').map(Number) as [number, number, number]
  const fin = Date.UTC(y2, m2 - 1, d2)
  const out: string[] = []
  for (let t = Date.UTC(y1, m1 - 1, d1); t <= fin && out.length <= MAX_DIAS_HISTORIAL; t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10))
  }
  return out
}

export interface FilaComidasDia extends Totales {
  fecha: string
  num_comidas: number
}

export function agregarHistorial(
  desde: string,
  hasta: string,
  comidas: FilaComidasDia[],
  agua: { fecha: string; ml: number }[],
  pesos: { fecha: string; peso: number }[],
  metas: Totales | null,
): Historial {
  const porDia = new Map(comidas.map((c) => [c.fecha, c]))
  const aguaDia = new Map(agua.map((a) => [a.fecha, a.ml]))
  const pesoDia = new Map(pesos.map((p) => [p.fecha, p.peso]))

  const dias: DiaHistorial[] = diasEntre(desde, hasta).map((fecha) => {
    const c = porDia.get(fecha)
    return {
      fecha,
      calorias: r1(c?.calorias ?? 0),
      proteinas: r1(c?.proteinas ?? 0),
      carbohidratos: r1(c?.carbohidratos ?? 0),
      grasas: r1(c?.grasas ?? 0),
      num_comidas: c?.num_comidas ?? 0,
      agua_ml: aguaDia.get(fecha) ?? 0,
      peso: pesoDia.get(fecha) ?? null,
    }
  })

  const conRegistro = dias.filter((d) => d.num_comidas > 0)
  const media = (k: keyof Totales | 'agua_ml', base: DiaHistorial[]) => (base.length ? r1(base.reduce((a, d) => a + d[k], 0) / base.length) : 0)
  const conAgua = dias.filter((d) => d.agua_ml > 0)
  const medias = conRegistro.length || conAgua.length
    ? {
        calorias: media('calorias', conRegistro),
        proteinas: media('proteinas', conRegistro),
        carbohidratos: media('carbohidratos', conRegistro),
        grasas: media('grasas', conRegistro),
        agua_ml: Math.round(media('agua_ml', conAgua)),
      }
    : null

  const enObjetivo = metas?.calorias ? conRegistro.filter((d) => Math.abs(d.calorias - metas.calorias) <= metas.calorias * 0.1).length : 0
  const conPeso = dias.filter((d) => d.peso !== null)
  const peso =
    conPeso.length > 0
      ? { inicio: conPeso[0]!.peso!, fin: conPeso.at(-1)!.peso!, cambio: r1(conPeso.at(-1)!.peso! - conPeso[0]!.peso!) }
      : null

  return { desde, hasta, dias, metas, medias, dias_con_registro: conRegistro.length, dias_en_objetivo: enObjetivo, peso }
}
