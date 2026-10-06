import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cx } from './ui/cx.ts'
import { desdeISO, fechaCorta, hoyISO, INICIAL_DIA, semanaDe, sumarDias } from '../lib/fechas.ts'

const NOMBRE_DIA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

/** Selector horizontal de días de la semana (lunes–domingo). */
export function SelectorSemana({ fecha, onChange }: { fecha: string; onChange: (f: string) => void }) {
  const hoy = hoyISO()
  const dias = semanaDe(fecha)
  const siguienteFuturo = sumarDias(dias[0]!, 7) > hoy
  return (
    <nav aria-label="Elegir día" className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(sumarDias(fecha, -7))}
        aria-label="Semana anterior"
        className="rounded-full p-1.5 text-neutral-500 dark:text-neutral-400 transition hover:bg-neutral-100 hover:text-graphite dark:hover:bg-neutral-800 dark:hover:text-white"
      >
        <ChevronLeft size={18} />
      </button>
      <ol className="grid flex-1 grid-cols-7 gap-1">
        {dias.map((d, i) => {
          const activo = d === fecha
          const futuro = d > hoy
          return (
            <li key={d}>
              <button
                type="button"
                disabled={futuro}
                onClick={() => onChange(d)}
                aria-current={activo ? 'date' : undefined}
                className={cx(
                  'flex w-full flex-col items-center gap-1 rounded-2xl py-2 transition-all duration-200 ease-suave disabled:cursor-default disabled:opacity-35',
                  activo ? 'bg-graphite text-white shadow-sm dark:bg-white dark:text-graphite' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800/70',
                )}
              >
                <span aria-hidden="true" className={cx('text-2xs font-medium', activo ? 'opacity-70' : 'text-neutral-500 dark:text-neutral-400')}>{INICIAL_DIA[i]}</span>
                <span className="sr-only">{NOMBRE_DIA[i]} </span>
                <span className="cifra text-[15px] font-semibold leading-none">{desdeISO(d).getDate()}</span>
                <span className="sr-only">{` ${fechaCorta(d).split(' ')[1] ?? ''}${d === hoy ? ', hoy' : ''}`}</span>
                <span className={cx('h-1 w-1 rounded-full', d === hoy ? (activo ? 'bg-mint-400' : 'bg-mint') : 'bg-transparent')} />
              </button>
            </li>
          )
        })}
      </ol>
      <button
        type="button"
        onClick={() => onChange(siguienteFuturo ? hoy : sumarDias(fecha, 7))}
        disabled={dias.includes(hoy)}
        aria-label="Semana siguiente"
        className="rounded-full p-1.5 text-neutral-500 dark:text-neutral-400 transition hover:bg-neutral-100 hover:text-graphite disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-neutral-800 dark:hover:text-white"
      >
        <ChevronRight size={18} />
      </button>
    </nav>
  )
}
