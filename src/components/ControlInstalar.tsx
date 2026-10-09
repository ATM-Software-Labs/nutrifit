/**
 * Botón «Instalar la app» del acceso y de Ajustes.
 * Si Chrome guardó `beforeinstallprompt`, abre el diálogo nativo.
 * Si no (Safari, ya instalada, o el evento no llegó), muestra la guía manual.
 */
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { instalarPWA, MENSAJE_INSTALAR_MANUAL } from '../lib/instalacion.ts'

export function ControlInstalar({ className, children }: { className?: string; children: ReactNode }) {
  const [guia, setGuia] = useState(false)
  const cerrar = useCallback(() => setGuia(false), [])

  async function pulsar() {
    try {
      if (await instalarPWA()) return
    } catch {
      /* El evento ya se usó o el navegador rechazó prompt(). */
    }
    setGuia(true)
  }

  return (
    <>
      <button type="button" className={className} onClick={() => void pulsar()}>
        {children}
      </button>
      {guia && <GuiaInstalar onCerrar={cerrar} />}
    </>
  )
}

function GuiaInstalar({ onCerrar }: { onCerrar: () => void }) {
  const tituloId = useId()
  const cerrarRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cerrarRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onCerrar()
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onCerrar])

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-neutral-950/40 p-4 sm:items-center" role="presentation" onClick={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className="w-full max-w-md rounded-3xl border border-neutral-200 bg-card p-5 shadow-lift dark:border-neutral-800 dark:bg-card-dark"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={tituloId} className="text-lg font-semibold tracking-tight">
          Instalar NutriFit
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">{MENSAJE_INSTALAR_MANUAL}</p>
        <button
          ref={cerrarRef}
          type="button"
          onClick={onCerrar}
          className="mt-4 h-11 w-full rounded-2xl bg-graphite text-sm font-semibold text-white dark:bg-white dark:text-graphite"
        >
          Entendido
        </button>
      </div>
    </div>,
    document.body,
  )
}
