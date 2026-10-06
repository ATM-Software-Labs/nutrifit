/** Helpers de diario_comidas. */
export interface FilaComida {
  id: string
  usuario_id: string
  tipo_comida: 'desayuno' | 'comida' | 'cena' | 'snack'
  descripcion: string
  calorias: number
  proteinas: number
  carbohidratos: number
  grasas: number
  ingredientes_json: string | null
  imagen_url: string | null
  fecha: string
  creado_en: string
}

/** Fila de BD → objeto de API (ingredientes parseados, sin usuario_id). */
export function aComidaApi(f: FilaComida) {
  let ingredientes: unknown[] = []
  try {
    ingredientes = f.ingredientes_json ? (JSON.parse(f.ingredientes_json) as unknown[]) : []
  } catch {
    ingredientes = []
  }
  const { usuario_id: _u, ingredientes_json: _i, ...resto } = f
  void _u
  void _i
  return { ...resto, ingredientes }
}
