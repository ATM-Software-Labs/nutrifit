import { useEffect, useState } from 'react'
import { IconoLogro } from './IconoLogro.tsx'
import { COLOR_NIVEL, type EstadoLogros, type Logro } from '../lib/logros.ts'

/** Escucha refrescos de logros y celebra los nuevos (sin animación con prefers-reduced-motion). */
export function CelebracionLogro() {
  const [cola, setCola] = useState<Logro[]>([])
  useEffect(() => {
    const f = (ev: Event) => {
      const e = (ev as CustomEvent<EstadoLogros>).detail
      const nuevos = e.logros.filter((l) => e.nuevos.includes(l.id))
      if (nuevos.length) setCola((c) => [...c, ...nuevos])
    }
    window.addEventListener('nf:logros', f)
    return () => window.removeEventListener('nf:logros', f)
  }, [])
  const actual = cola[0]
  useEffect(() => {
    if (!actual) return
    const t = setTimeout(() => setCola((c) => c.slice(1)), 4200)
    return () => clearTimeout(t)
  }, [actual])
  if (!actual) return null
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 top-[max(1rem,env(safe-area-inset-top))] z-[70] flex justify-center px-4">
      <button type="button" onClick={() => setCola((c) => c.slice(1))} className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-mint-200 bg-white/95 px-4 py-3 shadow-xl backdrop-blur dark:border-mint-900 dark:bg-neutral-900/95 motion-safe:animate-[nf-logro_600ms_cubic-bezier(.2,1.4,.4,1)]">
        <span className={`relative grid h-11 w-11 place-items-center rounded-full ${COLOR_NIVEL[actual.nivel]}`}>
          <span className="absolute inset-0 rounded-full ring-2 ring-mint-400/60 motion-safe:animate-ping" aria-hidden="true" />
          <IconoLogro icono={actual.icono} />
        </span>
        <span className="text-left">
          <span className="block text-xs font-medium uppercase tracking-wide text-mint-700 dark:text-mint-400">¡Logro desbloqueado!</span>
          <span className="block text-sm font-semibold">{actual.titulo}</span>
          <span className="block text-xs text-neutral-500 dark:text-neutral-400">{actual.detalle}</span>
        </span>
      </button>
    </div>
  )
}
