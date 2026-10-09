import { useNumeroAnimado } from '../hooks/useNumeroAnimado.ts'
import { entero } from '../lib/formato.ts'

const R = 96
const C = 2 * Math.PI * R

/** Anillo SVG de calorías restantes (meta − consumidas + quemadas), animado. */
export function AnilloCalorias({ consumidas, meta, quemadas = 0 }: { consumidas: number; meta: number; quemadas?: number }) {
  const extra = Math.max(0, quemadas)
  const restantes = meta - consumidas + extra
  const pasado = restantes < 0
  const presupuesto = meta + extra
  const progreso = presupuesto > 0 ? Math.min(1, consumidas / presupuesto) : 0
  const animado = useNumeroAnimado(Math.abs(restantes))
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[232px]">
      <svg viewBox="0 0 220 220" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="110" cy="110" r={R} fill="none" strokeWidth="10" className="stroke-neutral-100 dark:stroke-neutral-800" />
        <circle
          cx="110"
          cy="110"
          r={R}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - progreso)}
          className={`transition-[stroke-dashoffset] duration-1000 ease-suave ${pasado ? 'stroke-protein' : 'stroke-mint'}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" role="img" aria-label={`${entero(Math.abs(restantes))} kilocalorías ${pasado ? 'por encima del objetivo' : 'restantes'} de ${entero(meta)}`}>
        <span className="etiqueta">{pasado ? 'Te has pasado' : 'Restantes'}</span>
        <span className="cifra mt-1 text-[3.25rem] font-semibold leading-none tracking-tight">{entero(animado)}</span>
        <span className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          <span className="cifra">{entero(consumidas)}</span> / <span className="cifra">{entero(meta)}</span> kcal
        </span>
        {extra > 0 && <span className="mt-1 text-xs text-mint-700 dark:text-mint-400">+{entero(extra)} kcal de actividad</span>}
      </div>
    </div>
  )
}
