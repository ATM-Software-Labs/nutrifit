import { useState } from 'react'
import { Droplet, Plus, Minus, Dumbbell, Flame, Check } from 'lucide-react'
import { Card } from './Card.tsx'

interface Props {
  pesoKg?: number
}

export function PanelActividadHidratacion({ pesoKg = 85.5 }: Props) {
  // Hidratación calculada (35 ml / kg base)
  const metaAgua = Math.round(pesoKg * 35)
  const [aguaActual, setAguaActual] = useState(1500)

  // Entrenamientos
  const [minutos, setMinutos] = useState(45)
  const [tipo, setTipo] = useState<'fuerza' | 'cardio'>('fuerza')
  const [guardado, setGuardado] = useState(false)

  const factorMet = tipo === 'fuerza' ? 5 : 8
  const caloriasQuemadas = Math.round((factorMet * 3.5 * pesoKg / 200) * minutos)

  const registrarSesion = () => {
    setGuardado(true)
    setTimeout(() => setGuardado(false), 2000)
  }

  return (
    <div className="space-y-4">
      {/* Tarjeta Hidratación Dinámica */}
      <Card className="p-4 bg-zinc-900/70 border-zinc-800">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Droplet className="w-5 h-5 text-sky-400" />
            <span className="font-semibold text-white">Agua recomendada</span>
          </div>
          <span className="text-sm font-medium text-sky-400">
            {(aguaActual / 1000).toFixed(2)} / {(metaAgua / 1000).toFixed(2)} L
          </span>
        </div>
        <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden mb-3">
          <div 
            className="bg-sky-400 h-full transition-all duration-300"
            style={{ width: `${Math.min(100, (aguaActual / metaAgua) * 100)}%` }}
          />
        </div>
        <div className="flex gap-2">
          <button 
            type="button"
            onClick={() => setAguaActual(prev => Math.max(0, prev - 250))}
            className="flex-1 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-xs flex items-center justify-center gap-1"
          >
            <Minus className="w-3.5 h-3.5" /> 250 ml
          </button>
          <button 
            type="button"
            onClick={() => setAguaActual(prev => prev + 250)}
            className="flex-1 py-1.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 border border-sky-500/30 rounded text-xs flex items-center justify-center gap-1 font-medium"
          >
            <Plus className="w-3.5 h-3.5" /> 250 ml
          </button>
        </div>
      </Card>

      {/* Tarjeta Entrenamientos */}
      <Card className="p-4 bg-zinc-900/70 border-zinc-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Dumbbell className="w-5 h-5 text-emerald-400" />
            <span className="font-semibold text-white">Actividad física</span>
          </div>
          <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 flex items-center gap-1">
            <Flame className="w-3.5 h-3.5" /> ~{caloriasQuemadas} kcal
          </span>
        </div>
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => setTipo('fuerza')}
            className={`flex-1 py-1.5 rounded text-xs font-medium transition ${
              tipo === 'fuerza' ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-400'
            }`}
          >
            Fuerza / Gym
          </button>
          <button
            type="button"
            onClick={() => setTipo('cardio')}
            className={`flex-1 py-1.5 rounded text-xs font-medium transition ${
              tipo === 'cardio' ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-400'
            }`}
          >
            Cardio
          </button>
        </div>
        <div className="flex items-center justify-between text-xs text-zinc-400 mb-3">
          <span>Duración: {minutos} min</span>
          <input
            type="range"
            min="15"
            max="120"
            step="5"
            value={minutos}
            onChange={(e) => setMinutos(Number(e.target.value))}
            className="w-32 accent-emerald-500"
          />
        </div>
        <button
          type="button"
          onClick={registrarSesion}
          className="w-full py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded text-xs font-medium flex items-center justify-center gap-1.5 transition"
        >
          {guardado ? <><Check className="w-3.5 h-3.5" /> Registrado</> : 'Añadir sesión al balance'}
        </button>
      </Card>
    </div>
  )
}
