import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cx } from './cx.ts'

const FOCUSABLES = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select,textarea,[tabindex]:not([tabindex="-1"])'

interface SheetProps {
  abierto: boolean
  onClose: () => void
  titulo: string
  descripcion?: string
  children: ReactNode
  pie?: ReactNode
  /** Ancho máximo en escritorio. */
  ancho?: 'sm' | 'md' | 'lg'
  ocultarTitulo?: boolean
}

/**
 * Hoja inferior en móvil / modal centrado en escritorio.
 * Accesible: role=dialog + aria-modal, foco atrapado, Esc cierra, devuelve el foco.
 */
export function Sheet({ abierto, onClose, titulo, descripcion, children, pie, ancho = 'md', ocultarTitulo }: SheetProps) {
  const ref = useRef<HTMLDivElement>(null)
  const idTitulo = useId()
  const idDesc = useId()
  const cerrarRef = useRef(onClose)
  cerrarRef.current = onClose

  useEffect(() => {
    if (!abierto) return
    const previo = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const panel = ref.current
    // Foco inicial: primer campo con autofocus o el panel.
    requestAnimationFrame(() => {
      const auto = panel?.querySelector<HTMLElement>('[data-autofocus]')
      ;(auto ?? panel)?.focus()
    })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        cerrarRef.current()
      } else if (e.key === 'Tab' && panel) {
        const els = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLES)).filter((el) => el.offsetParent !== null)
        if (!els.length) return
        const primero = els[0]!
        const ultimo = els[els.length - 1]!
        if (e.shiftKey && (document.activeElement === primero || document.activeElement === panel)) {
          e.preventDefault()
          ultimo.focus()
        } else if (!e.shiftKey && document.activeElement === ultimo) {
          e.preventDefault()
          primero.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previo?.focus?.()
    }
  }, [abierto])

  if (!abierto) return null
  const anchos = { sm: 'sm:max-w-sm', md: 'sm:max-w-md', lg: 'sm:max-w-lg' }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 animate-fade-in bg-neutral-950/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        aria-describedby={descripcion ? idDesc : undefined}
        tabIndex={-1}
        className={cx(
          'relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-neutral-200 bg-card shadow-sheet outline-none dark:border-neutral-800 dark:bg-card-dark',
          'animate-slide-up sm:animate-pop-in sm:rounded-3xl',
          anchos[ancho],
        )}
      >
        <div className="mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-neutral-200 sm:hidden dark:bg-neutral-700" aria-hidden="true" />
        <header className={cx('flex items-start gap-3 px-6 pb-2 pt-4', ocultarTitulo && 'sr-only')}>
          <div className="min-w-0 flex-1">
            <h2 id={idTitulo} className="text-lg font-semibold tracking-tight">
              {titulo}
            </h2>
            {descripcion && (
              <p id={idDesc} className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
                {descripcion}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="-mr-2 -mt-1 rounded-full p-2 text-neutral-500 dark:text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-graphite dark:hover:bg-neutral-800 dark:hover:text-white"
          >
            <X size={20} strokeWidth={2} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto overscroll-contain px-6 pb-6 pt-2">{children}</div>
        {pie && (
          <footer className="border-t border-neutral-200 px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-neutral-800">{pie}</footer>
        )}
      </div>
    </div>,
    document.body,
  )
}
