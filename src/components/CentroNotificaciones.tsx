import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bell } from 'lucide-react'
import { pedirApi } from '../lib/api.ts'

interface Notif { id: string; tipo: string; titulo: string; cuerpo: string; url: string | null; leida: number; creado_en: string }

const relativo = (s: string) => {
  const min = Math.round((Date.now() - Date.parse(s.replace(' ', 'T') + (s.includes('Z') ? '' : 'Z'))) / 60000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  if (min < 1440) return `hace ${Math.round(min / 60)} h`
  return `hace ${Math.round(min / 1440)} d`
}

/** Campana con contador de no leídas y panel desplegable. */
export function CentroNotificaciones({ alinear = 'derecha' }: { alinear?: 'derecha' | 'izquierda' }) {
  const [abierto, setAbierto] = useState(false)
  const [lista, setLista] = useState<Notif[]>([])
  const [noLeidas, setNoLeidas] = useState(0)
  const botonRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState<{ top: number; left?: number; right?: number }>({ top: 0 })
  const recolocar = useCallback(() => {
    const r = botonRef.current?.getBoundingClientRect()
    if (!r) return
    setPos(alinear === 'derecha' ? { top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) } : { top: r.bottom + 8, left: Math.max(8, r.left) })
  }, [alinear])
  useEffect(() => {
    if (!abierto) return
    recolocar()
    window.addEventListener('resize', recolocar)
    window.addEventListener('scroll', recolocar, true)
    return () => { window.removeEventListener('resize', recolocar); window.removeEventListener('scroll', recolocar, true) }
  }, [abierto, recolocar])
  const cargar = useCallback(() => {
    pedirApi<{ notificaciones: Notif[]; noLeidas: number }>('/api/notificaciones').then((r) => { setLista(r.notificaciones); setNoLeidas(r.noLeidas) }).catch(() => {})
  }, [])
  useEffect(() => {
    cargar()
    const t = setInterval(cargar, 5 * 60_000)
    const f = () => cargar()
    window.addEventListener('nf:logros', f)
    return () => { clearInterval(t); window.removeEventListener('nf:logros', f) }
  }, [cargar])
  const abrir = () => {
    setAbierto((v) => !v)
    if (!abierto && noLeidas) {
      setNoLeidas(0)
      void pedirApi('/api/notificaciones', { method: 'POST', body: {} }).catch(() => {})
    }
  }
  return (
    <div className="relative">
      <button ref={botonRef} type="button" onClick={abrir} aria-label={noLeidas ? `Notificaciones, ${noLeidas} sin leer` : 'Notificaciones'} aria-expanded={abierto} className="relative rounded-full p-2 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800">
        <Bell size={20} strokeWidth={1.75} />
        {noLeidas > 0 && <span className="cifra absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-mint-600 px-1 text-[10px] font-semibold text-white">{noLeidas > 9 ? '9+' : noLeidas}</span>}
      </button>
      {abierto && createPortal(
        <>
          <div className="fixed inset-0 z-[90]" onClick={() => setAbierto(false)} aria-hidden="true" />
          <div role="dialog" aria-label="Notificaciones" style={pos} className={`fixed z-[100] w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-lg dark:border-neutral-800 dark:bg-neutral-900`}>
            <p className="border-b border-neutral-100 px-4 py-3 text-sm font-semibold dark:border-neutral-800">Notificaciones</p>
            {lista.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-neutral-500">Aún no tienes notificaciones.</p>
            ) : (
              <ul className="max-h-96 divide-y divide-neutral-100 overflow-y-auto dark:divide-neutral-800">
                {lista.map((n) => (
                  <li key={n.id}>
                    <a href={n.url || '/'} onClick={() => setAbierto(false)} className={`block px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 ${n.leida ? '' : 'bg-mint-50/60 dark:bg-mint-950/20'}`}>
                      <p className="text-sm font-medium">{n.titulo}</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">{n.cuerpo}</p>
                      <p className="mt-0.5 text-[11px] text-neutral-400">{relativo(n.creado_en)}</p>
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <a href="/ajustes#notificaciones" onClick={() => setAbierto(false)} className="block border-t border-neutral-100 px-4 py-2.5 text-center text-xs font-medium text-mint-700 dark:border-neutral-800 dark:text-mint-400">Configurar avisos</a>
          </div>
        </>,
        document.body,
      )}
    </div>
  )
}
