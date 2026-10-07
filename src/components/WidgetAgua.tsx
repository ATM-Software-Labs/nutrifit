import { Droplet, Plus, Minus } from 'lucide-react'
import { Card } from './Card.tsx'

interface Props {
  fecha?: string
  inicial?: number
  onCambio?: (ml: number) => void
  pesoKg?: number
}

export function WidgetAgua({ inicial = 0, onCambio, pesoKg = 75 }: Props) {
  const meta = Math.round(pesoKg * 35)

  return (
    <Card className="p-4 bg-zinc-900/60 border-zinc-800">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Droplet className="w-5 h-5 text-sky-400" />
          <span className="font-semibold text-white">Agua</span>
        </div>
        <span className="text-sm text-zinc-400">{(inicial / 1000).toFixed(1)} / {(meta / 1000).toFixed(1)} L</span>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onCambio?.(Math.max(0, inicial - 250))}
          className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm flex items-center justify-center gap-1"
        >
          <Minus className="w-4 h-4" /> 250 ml
        </button>
        <button
          onClick={() => onCambio?.(inicial + 250)}
          className="flex-1 py-2 bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 border border-sky-500/30 rounded-lg text-sm flex items-center justify-center gap-1 font-medium"
        >
          <Plus className="w-4 h-4" /> 250 ml
        </button>
      </div>
    </Card>
  )
}
