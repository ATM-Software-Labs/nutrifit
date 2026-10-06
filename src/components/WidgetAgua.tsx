import { useEffect, useRef, useState } from 'react'
import { Droplet, Minus } from 'lucide-react'
import { useToast } from './ui/Toast.tsx'
import { api } from '../lib/api.ts'
import { litros } from '../lib/formato.ts'
import { META_AGUA_ML as META_ML } from '../lib/config.ts'

/** Agua del día: barra de progreso y +250/+500 ml con estado optimista. */
export function WidgetAgua({ fecha, inicial, onCambio }: { fecha: string; inicial: number; onCambio?: (ml: number) => void }) {
  const [ml, setMl] = useState(inicial)
  const confirmado = useRef(inicial)
  const toast = useToast()
  useEffect(() => {
    setMl(inicial)
    confirmado.current = inicial
  }, [inicial, fecha])

  async function sumar(delta: number) {
    const previo = ml
    const nuevo = Math.max(0, Math.min(10000, previo + delta))
    if (nuevo === previo) return
    setMl(nuevo)
    try {
      const r = await api.agua(fecha, delta, 'sumar')
      confirmado.current = r.ml
      setMl(r.ml)
      onCambio?.(r.ml)
    } catch (e) {
      setMl(confirmado.current)
      toast({ tipo: 'error', mensaje: e instanceof Error ? e.message : 'No se pudo guardar el agua.' })
    }
  }

  const pct = Math.min(100, Math.round((ml / META_ML) * 100))
  return (
    <section id="agua" className="tarjeta scroll-mt-6 p-5" aria-labelledby="titulo-agua">
      <div className="flex items-center justify-between">
        <h2 id="titulo-agua" className="flex items-center gap-2 font-semibold">
          <Droplet size={16} strokeWidth={2} className="text-water" /> Agua
        </h2>
        <p className="cifra text-sm text-neutral-500 dark:text-neutral-400">
          <span className="font-medium text-graphite dark:text-neutral-100">{litros(ml)}</span> / {litros(META_ML)}
        </p>
      </div>
      <div
        className="mt-4 h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800"
        role="progressbar"
        aria-label="Agua bebida"
        aria-valuemin={0}
        aria-valuemax={META_ML}
        aria-valuenow={ml}
        aria-valuetext={`${litros(ml)} de ${litros(META_ML)}`}
      >
        <div className="h-full rounded-full bg-water transition-[width] duration-500 ease-suave" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => void sumar(-250)}
          disabled={ml <= 0}
          aria-label="Quitar 250 ml"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 text-neutral-500 transition hover:bg-neutral-50 disabled:opacity-40 dark:border-neutral-800 dark:hover:bg-neutral-900"
        >
          <Minus size={16} />
        </button>
        {[250, 500].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => void sumar(d)}
            className="h-10 flex-1 rounded-xl border border-neutral-200 text-sm font-medium transition hover:border-water/50 hover:bg-water/5 active:scale-[0.98] dark:border-neutral-800"
          >
            + {d} ml
          </button>
        ))}
      </div>
    </section>
  )
}
