import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { Check, CircleAlert, Info, X } from 'lucide-react'
import { cx } from './cx.ts'

type TipoToast = 'exito' | 'error' | 'info'
interface Toast {
  id: number
  mensaje: string
  tipo: TipoToast
  accion?: { etiqueta: string; onClick: () => void }
  duracion: number
}
type NuevoToast = Omit<Toast, 'id' | 'tipo' | 'duracion'> & { tipo?: TipoToast; duracion?: number }

const Ctx = createContext<(t: NuevoToast) => void>(() => {})
export const useToast = () => useContext(Ctx)

const ICONOS = { exito: Check, error: CircleAlert, info: Info }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const n = useRef(0)
  const quitar = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])
  const mostrar = useCallback(
    (t: NuevoToast) => {
      const id = ++n.current
      const toast: Toast = { tipo: 'info', duracion: 4000, ...t, id }
      setToasts((xs) => [...xs.slice(-2), toast])
      if (toast.duracion > 0) setTimeout(() => quitar(id), toast.duracion)
    },
    [quitar],
  )
  const valor = useMemo(() => mostrar, [mostrar])

  return (
    <Ctx.Provider value={valor}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4 pt-[max(1rem,env(safe-area-inset-top))]"
      >
        {toasts.map((t) => {
          const Icono = ICONOS[t.tipo]
          return (
            <div
              key={t.id}
              role={t.tipo === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto flex w-full max-w-sm animate-toast-in items-center gap-3 rounded-2xl border border-neutral-200 bg-card/95 py-3 pl-4 pr-2 text-sm shadow-lift backdrop-blur dark:border-neutral-800 dark:bg-card-dark/95"
            >
              <span
                className={cx(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                  t.tipo === 'exito' && 'bg-mint-50 text-mint-600 dark:bg-mint-950 dark:text-mint-400',
                  t.tipo === 'error' && 'bg-red-50 text-protein dark:bg-red-950/50',
                  t.tipo === 'info' && 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300',
                )}
              >
                <Icono size={14} strokeWidth={2.5} />
              </span>
              <p className="flex-1">{t.mensaje}</p>
              {t.accion && (
                <button
                  type="button"
                  onClick={() => {
                    t.accion!.onClick()
                    quitar(t.id)
                  }}
                  className="rounded-lg px-2.5 py-1.5 font-medium text-mint-700 hover:bg-mint-50 dark:text-mint-400 dark:hover:bg-mint-950"
                >
                  {t.accion.etiqueta}
                </button>
              )}
              <button type="button" onClick={() => quitar(t.id)} aria-label="Cerrar aviso" className="rounded-lg p-1.5 text-neutral-500 dark:text-neutral-400 hover:text-graphite dark:hover:text-white">
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </Ctx.Provider>
  )
}
