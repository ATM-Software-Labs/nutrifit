/** Tipo de día (descanso / entreno) con metas ajustadas. «Auto» = según el horario de Ajustes. */
import { useState } from 'react'
import { BedDouble, Dumbbell, Sparkles } from 'lucide-react'
import { cx } from './ui/cx.ts'
import { api } from '../lib/api.ts'
import { entero } from '../lib/formato.ts'
import type { Resumen, TipoDia } from '../lib/tipos.ts'

export function SelectorTipoDia({ fecha, resumen, onCambio }: { fecha: string; resumen: Resumen; onCambio: () => void }) {
  const [guardando, setGuardando] = useState(false)
  const tipo = resumen.tipo_dia ?? null
  const manual = resumen.tipo_dia_origen === 'manual'
  const delta = resumen.metas && resumen.metas_base ? resumen.metas.calorias - resumen.metas_base.calorias : 0

  async function marcar(t: TipoDia | null) {
    setGuardando(true)
    try {
      await api.marcarTipoDia(fecha, t)
      onCambio()
    } finally {
      setGuardando(false)
    }
  }

  const opciones: { valor: TipoDia | null; etiqueta: string; icono: React.ReactNode; activo: boolean }[] = [
    { valor: null, etiqueta: 'Auto', icono: <Sparkles size={14} />, activo: !manual },
    { valor: 'descanso', etiqueta: 'Descanso', icono: <BedDouble size={14} />, activo: manual && tipo === 'descanso' },
    { valor: 'entreno', etiqueta: 'Entreno', icono: <Dumbbell size={14} />, activo: manual && tipo === 'entreno' },
  ]

  const Icono = tipo === 'entreno' ? Dumbbell : tipo === 'descanso' ? BedDouble : Sparkles

  return (
    <div data-testid="tipo-dia" className="tarjeta space-y-3 p-3 sm:p-4">
      <div className="flex items-center gap-3">
        <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', tipo === 'entreno' ? 'bg-mint-500/10 text-mint-600 dark:text-mint-400' : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400')} aria-hidden="true">
          <Icono size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{tipo === 'entreno' ? 'Día de entreno' : tipo === 'descanso' ? 'Día de descanso' : 'Día normal'}</p>
          <p className="cifra truncate text-xs text-neutral-500 dark:text-neutral-400">
            {resumen.metas ? `${entero(resumen.metas.calorias)} kcal objetivo` : 'Sin objetivo'}
            {delta !== 0 && <span className={delta > 0 ? 'text-mint-600 dark:text-mint-400' : 'text-carbs'}> ({delta > 0 ? '+' : ''}{entero(delta)})</span>}
            {!manual && tipo && ' · según tu horario'}
          </p>
        </div>
      </div>
      <div role="radiogroup" aria-label="Tipo de día" className="grid grid-cols-3 rounded-xl bg-neutral-100 p-0.5 dark:bg-neutral-800">
        {opciones.map((o) => (
          <button
            key={o.etiqueta}
            type="button"
            role="radio"
            aria-checked={o.activo}
            disabled={guardando}
            onClick={() => !o.activo && void marcar(o.valor)}
            className={cx(
              'flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs transition',
              o.activo ? 'bg-white font-semibold text-graphite shadow-sm dark:bg-neutral-700 dark:text-white' : 'text-neutral-600 hover:text-graphite dark:text-neutral-400 dark:hover:text-white',
            )}
          >
            {o.icono} {o.etiqueta}
          </button>
        ))}
      </div>
    </div>
  )
}
