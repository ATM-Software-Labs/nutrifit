import { useState } from 'react'
import { Card } from './ui/Card.tsx'
import { Sliders } from 'lucide-react'

/** Ajustes locales de balance. Strava no se conecta desde aquí. */
export function SeccionAjustesExtendidos() {
  const [ajusteCaloriasActividad, setAjusteCaloriasActividad] = useState(
    () => localStorage.getItem('nutrifit_auto_calorias') !== 'false',
  )
  const [modoMacros, setModoMacros] = useState<'gramos_kg' | 'porcentaje'>(
    () => (localStorage.getItem('nutrifit_modo_macros') as 'gramos_kg' | 'porcentaje' | null) || 'gramos_kg',
  )
  const [proteinaGKg, setProteinaGKg] = useState(2.0)
  const [grasaGKg, setGrasaGKg] = useState(0.8)

  const toggleAjuste = (val: boolean) => {
    setAjusteCaloriasActividad(val)
    localStorage.setItem('nutrifit_auto_calorias', String(val))
  }

  const toggleModo = (modo: 'gramos_kg' | 'porcentaje') => {
    setModoMacros(modo)
    localStorage.setItem('nutrifit_modo_macros', modo)
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-zinc-900/60 border-zinc-800">
        <div className="flex items-center gap-2 mb-3">
          <Sliders className="w-5 h-5 text-emerald-400" />
          <span className="font-semibold text-white">Ajustes de Balance y Macros</span>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs text-zinc-300">Ajuste calórico dinámico</label>
            <input
              type="checkbox"
              checked={ajusteCaloriasActividad}
              onChange={(e) => toggleAjuste(e.target.checked)}
              className="w-4 h-4 accent-emerald-500 cursor-pointer"
            />
          </div>

          <div className="pt-2 border-t border-zinc-800">
            <label className="text-xs text-zinc-400 block mb-2">Modo de cálculo</label>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                type="button"
                onClick={() => toggleModo('gramos_kg')}
                className={`py-1.5 text-xs rounded font-medium ${
                  modoMacros === 'gramos_kg' ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                Gramos/kg
              </button>
              <button
                type="button"
                onClick={() => toggleModo('porcentaje')}
                className={`py-1.5 text-xs rounded font-medium ${
                  modoMacros === 'porcentaje' ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                Porcentajes (%)
              </button>
            </div>

            {modoMacros === 'gramos_kg' && (
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-zinc-300">
                  <span>Proteína: {proteinaGKg} g/kg</span>
                  <input
                    type="range"
                    min="1.2"
                    max="2.8"
                    step="0.1"
                    value={proteinaGKg}
                    onChange={(e) => setProteinaGKg(Number(e.target.value))}
                    className="w-28 accent-emerald-500"
                  />
                </div>
                <div className="flex justify-between text-zinc-300">
                  <span>Grasas: {grasaGKg} g/kg</span>
                  <input
                    type="range"
                    min="0.5"
                    max="1.5"
                    step="0.1"
                    value={grasaGKg}
                    onChange={(e) => setGrasaGKg(Number(e.target.value))}
                    className="w-28 accent-emerald-500"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}
