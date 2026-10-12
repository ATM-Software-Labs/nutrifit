import { Flame, Lock, Snowflake } from 'lucide-react'
import { IconoLogro } from './IconoLogro.tsx'
import { COLOR_NIVEL, useLogros } from '../lib/logros.ts'
import { Spinner } from './ui/Spinner.tsx'

const fmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' })

export default function PaginaLogros() {
  const e = useLogros()
  if (!e) return <div className="grid min-h-[40vh] place-items-center"><Spinner /></div>
  const hechos = e.logros.filter((l) => l.desbloqueado)
  const orden = [...e.logros].sort((a, b) => Number(b.desbloqueado) - Number(a.desbloqueado) || b.progreso / b.meta - a.progreso / a.meta)
  const s = e.semana
  return (
    <main className="px-5 pb-10 md:mx-auto md:max-w-3xl lg:max-w-5xl lg:px-10 lg:pt-6">
      <h1 className="hidden text-2xl font-semibold tracking-tight lg:block">Logros</h1>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div className="tarjeta p-4">
          <p className="text-xs text-neutral-500">Racha actual</p>
          <p className="mt-1 flex items-center gap-1.5 text-2xl font-semibold"><Flame size={20} className="text-mint-600" aria-hidden="true" /><span className="cifra">{e.racha.actual}</span></p>
          <p className="text-xs text-neutral-500">Mejor: {e.racha.mejor} días</p>
        </div>
        <div className="tarjeta p-4">
          <p className="text-xs text-neutral-500">Esta semana</p>
          <p className="mt-1 text-2xl font-semibold"><span className="cifra">{s.adherenciaPct}</span>%</p>
          <p className="text-xs text-neutral-500">{s.diasRegistrados} días registrados · {s.diasEnObjetivo} en objetivo{s.mediaCalorias ? ` · ${s.mediaCalorias} kcal/día` : ''}</p>
        </div>
        <div className="tarjeta p-4">
          <p className="text-xs text-neutral-500">Desbloqueados</p>
          <p className="mt-1 text-2xl font-semibold"><span className="cifra">{hechos.length}</span><span className="text-base text-neutral-400">/{e.logros.length}</span></p>
          <p className="flex items-center gap-1 text-xs text-neutral-500"><Snowflake size={11} aria-hidden="true" /> {e.racha.comodinDisponible ? 'Comodín semanal disponible' : 'Comodín de esta semana usado'}</p>
        </div>
      </div>
      <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {orden.map((l) => {
          const pct = Math.round((l.progreso / l.meta) * 100)
          return (
            <li key={l.id} className={`tarjeta flex flex-col items-center p-4 text-center ${l.desbloqueado ? '' : 'opacity-70'}`}>
              <span className={`relative grid h-14 w-14 place-items-center rounded-full ${l.desbloqueado ? COLOR_NIVEL[l.nivel] : 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800'}`}>
                <IconoLogro icono={l.icono} size={24} />
                {!l.desbloqueado && <Lock size={12} className="absolute -bottom-0.5 -right-0.5 rounded-full bg-white p-0.5 text-neutral-500 dark:bg-neutral-900" aria-hidden="true" />}
              </span>
              <p className="mt-2.5 text-sm font-semibold leading-tight">{l.titulo}</p>
              <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{l.detalle}</p>
              <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-neutral-400">{l.nivel}</p>
              {l.desbloqueado ? (
                <p className="mt-2 text-xs text-mint-700 dark:text-mint-400">{l.desbloqueado_en ? fmt.format(new Date(l.desbloqueado_en.replace(' ', 'T') + (l.desbloqueado_en.includes('Z') ? '' : 'Z'))) : 'Conseguido'}</p>
              ) : (
                <div className="mt-2 w-full" aria-label={`Progreso ${l.progreso} de ${l.meta}`}>
                  <div className="h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"><div className="h-full rounded-full bg-mint-500" style={{ width: `${pct}%` }} /></div>
                  <p className="cifra mt-1 text-[11px] text-neutral-500">{l.progreso}/{l.meta}</p>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </main>
  )
}
