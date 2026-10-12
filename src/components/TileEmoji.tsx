import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { EMOJIS_COMIDA } from '../lib/miniaturaComida.ts'
import { cx } from './ui/cx.ts'

/** Círculo nórdico (pizarra/menta suave) con el emoji de la comida. */
export function TileEmoji({ emoji, tam = 'md', className }: { emoji: string; tam?: 'md' | 'lg'; className?: string }) {
  return (
    <span aria-hidden="true" className={cx('flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-mint-50 to-slate-100 ring-1 ring-mint-100 dark:from-mint-950/40 dark:to-slate-800 dark:ring-slate-700', tam === 'lg' ? 'size-20 text-[44px]' : 'size-10 text-[22px]', className)}>
      <span className="block leading-none">{emoji}</span>
    </span>
  )
}

/** Tile pulsable que abre un selector de emojis. */
export function SelectorEmoji({ emoji, onElegir, tam = 'md' }: { emoji: string; onElegir: (e: string) => void; tam?: 'md' | 'lg' }) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  useEffect(() => {
    if (!abierto || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    const ancho = 280
    setPos({ top: Math.min(r.bottom + 8, window.innerHeight - 260), left: Math.max(8, Math.min(r.left, window.innerWidth - ancho - 8)) })
  }, [abierto])
  return (
    <>
      <button ref={ref} type="button" onClick={() => setAbierto((v) => !v)} aria-label={`Cambiar emoji (${emoji})`} aria-expanded={abierto} className="rounded-full focus-visible:outline-2 focus-visible:outline-mint">
        <TileEmoji emoji={emoji} tam={tam} />
      </button>
      {abierto &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[90]" onClick={() => setAbierto(false)} aria-hidden="true" />
            <div role="dialog" aria-label="Elige un emoji" style={pos} className="fixed z-[100] grid w-[280px] grid-cols-7 gap-1 rounded-2xl border border-neutral-200 bg-white p-2 shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
              {EMOJIS_COMIDA.map((e) => (
                <button key={e} type="button" onClick={() => { onElegir(e); setAbierto(false) }} className={cx('grid size-9 place-items-center rounded-full text-xl hover:bg-mint-50 dark:hover:bg-neutral-800', e === emoji && 'bg-mint-100 dark:bg-mint-950')}>
                  {e}
                </button>
              ))}
            </div>
          </>,
          document.body,
        )}
    </>
  )
}
