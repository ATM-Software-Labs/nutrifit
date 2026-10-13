import { useState } from 'react'
import { contarTodasBebidas, setContarTodasBebidas } from '../lib/preferenciasLiquidos.ts'

/** Ajustes › Unidades: qué bebidas suman al objetivo de agua. */
export function AjusteBebidasAgua() {
  const [on, setOn] = useState(contarTodasBebidas)
  const cambiar = () => { setContarTodasBebidas(!on); setOn(!on) }
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex-1">
        <p className="text-[15px] font-medium">Todas las bebidas suman al agua</p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">Por defecto solo cuentan el agua, las infusiones y las bebidas sin calorías. Actívalo para sumar también zumos, leche, refrescos o batidos.</p>
      </div>
      <button type="button" role="switch" aria-checked={on} aria-label="Todas las bebidas suman al agua" onClick={cambiar} className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${on ? 'bg-mint-700' : 'bg-neutral-300 dark:bg-neutral-700'}`}>
        <span className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  )
}
