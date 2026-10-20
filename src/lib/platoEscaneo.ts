import type { CategoriaPlato, ResultadoAnalisis } from './tipos.ts'

export interface PlatoEscaneo {
  alimento: string
  descripcion?: string
  categoria?: CategoriaPlato
  emoji?: string
  peso_aprox_g: number
  calorias: number
  macros: { proteinas: number; carbohidratos: number; grasas: number }
  alternativas: string[]
  items?: { nombre: string; gramos: number; calorias: number; proteinas: number; carbohidratos: number; grasas: number }[]
  catalogo?: 'ok' | 'no_disponible' | 'sin_config'
  afinados?: number
}

/** El escáner devuelve el plato unificado. La revisión lo trata como un ingrediente. */
export function resultadoDesdePlato(p: PlatoEscaneo): ResultadoAnalisis {
  const fila = {
    nombre: p.alimento,
    display_name: p.alimento,
    gramos: p.peso_aprox_g,
    calorias: p.calorias,
    proteinas: p.macros.proteinas,
    carbohidratos: p.macros.carbohidratos,
    grasas: p.macros.grasas,
  }
  return {
    nombre_plato: p.alimento,
    display_name: p.alimento,
    ...(p.descripcion ? { descripcion: p.descripcion } : {}),
    ...(p.categoria ? { categoria: p.categoria } : {}),
    ...(p.emoji ? { emoji: p.emoji } : {}),
    // Con desglose, cada pieza va con su cantidad ("2 rebanadas de pan tostado") y los totales son la suma.
    ingredientes: p.items?.length ? p.items.map((i) => ({ ...i, display_name: i.nombre })) : [fila],
    calorias: p.calorias,
    proteinas: p.macros.proteinas,
    carbohidratos: p.macros.carbohidratos,
    grasas: p.macros.grasas,
    alternativas: p.alternativas.map((nombre) => ({ ...fila, nombre, display_name: nombre })),
    ...(p.catalogo === 'no_disponible' ? { precision_reducida: true } : {}),
    ...(p.afinados ? { afinados: p.afinados } : {}),
  }
}
