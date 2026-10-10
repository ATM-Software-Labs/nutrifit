import { ArrowRight, Scale } from 'lucide-react'
import { navegar } from '../lib/rutas.ts'
import type { Usuario } from '../lib/tipos.ts'

export function WidgetPeso({ usuario }: { usuario: Usuario }) {
  return (
    <div className="tarjeta p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="flex items-center gap-2 font-semibold text-graphite dark:text-neutral-200">
          <Scale size={16} strokeWidth={2} className="text-emerald-600 dark:text-emerald-400" /> Control de Peso
        </h2>
        <button
          onClick={() => navegar('/peso')}
          className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 transition"
        >
          Ver detalles <ArrowRight size={14} />
        </button>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs text-neutral-500 mb-1">Peso Actual</p>
          <p className="text-2xl font-bold text-graphite dark:text-neutral-100">
            {usuario.peso_kg ? `${usuario.peso_kg} kg` : '--'}
          </p>
        </div>
      </div>
    </div>
  )
}
