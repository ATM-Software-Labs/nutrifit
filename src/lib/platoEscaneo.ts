import type { ResultadoAnalisis } from './tipos.ts'

export interface PlatoEscaneo {
  alimento: string
  peso_aprox_g: number
  calorias: number
  macros: { proteinas: number; carbohidratos: number; grasas: number }
  alternativas: string[]
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
    ingredientes: [fila],
    calorias: p.calorias,
    proteinas: p.macros.proteinas,
    carbohidratos: p.macros.carbohidratos,
    grasas: p.macros.grasas,
    alternativas: p.alternativas.map((nombre) => ({ ...fila, nombre, display_name: nombre })),
  }
}
