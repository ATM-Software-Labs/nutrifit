import { Flame, Snowflake, Trophy } from 'lucide-react'
import { useLogros } from '../lib/logros.ts'
import { navegar } from '../lib/rutas.ts'

/** Racha diaria con anillo de la semana y acceso a Logros. */
export function TarjetaRacha() {
  const e = useLogros()
  if (!e) return <section className="tarjeta h-[6.5rem] animate-pulse" aria-hidden="true" />
  const { racha, semana, logros } = e
  const hechos = logros.filter((l) => l.desbloqueado).length
  const pct = Math.min(100, semana.adherenciaPct)
  const r = 22
  const c = 2 * Math.PI * r
  return (
    <section className="tarjeta flex items-center gap-4 p-4" aria-label="Racha y logros">
      <div className="relative h-14 w-14 shrink-0">
        <svg viewBox="0 0 56 56" className="h-14 w-14 -rotate-90" aria-hidden="true">
          <circle cx="28" cy="28" r={r} fill="none" strokeWidth="4" className="stroke-neutral-200 dark:stroke-neutral-800" />
          <circle cx="28" cy="28" r={r} fill="none" strokeWidth="4" strokeLinecap="round" className="stroke-mint-500 transition-[stroke-dashoffset] duration-700" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} />
        </svg>
        <Flame size={22} strokeWidth={1.75} className={`absolute inset-0 m-auto ${racha.hoyRegistrado ? 'text-mint-600 dark:text-mint-400' : 'text-neutral-400'}`} aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Racha</p>
        <p className="text-xl font-semibold tracking-tight">
          <span className="cifra">{racha.actual}</span> {racha.actual === 1 ? 'día' : 'días'}
        </p>
        <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
          {racha.hoyRegistrado ? 'Hoy ya cuenta' : racha.actual > 0 ? 'Registra algo hoy para mantenerla' : 'Registra una comida para empezar'} · Mejor: {racha.mejor}
          {racha.comodinDisponible && (
            <span className="ml-1 inline-flex items-center gap-0.5" title="Un día sin registro por semana no rompe tu racha">
              · <Snowflake size={11} aria-hidden="true" /> comodín
            </span>
          )}
        </p>
      </div>
      <button type="button" onClick={() => navegar('/logros')} className="flex shrink-0 flex-col items-center rounded-xl px-2.5 py-1.5 text-xs text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800" aria-label={`Ver logros, ${hechos} desbloqueados`}>
        <Trophy size={18} strokeWidth={1.75} className="text-mint-700 dark:text-mint-400" aria-hidden="true" />
        <span className="cifra mt-0.5 font-medium">{hechos}/{logros.length}</span>
      </button>
    </section>
  )
}
