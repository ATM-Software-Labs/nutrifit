/**
 * Invitación a instalar la PWA:
 *  · iPhone/iPad en Safari (no instalada) → pasos visuales Compartir → Añadir a inicio.
 *  · Android/Chrome → evento beforeinstallprompt → botón "Instalar".
 * Se puede descartar (se recuerda 30 días en localStorage).
 */
import { useEffect, useState } from 'react'
import { SquarePlus, X } from 'lucide-react'
import { Logo } from './Logo.tsx'
import { Button } from './ui/Button.tsx'
import { esNativa } from '../lib/plataforma.ts'

interface EventoInstalar extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const CLAVE = 'nf:banner-pwa'
const DIAS = 30

function descartadoReciente() {
  const t = Number(localStorage.getItem(CLAVE) ?? 0)
  return Date.now() - t < DIAS * 86_400_000
}

function esIOSSafari() {
  const ua = navigator.userAgent
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA/.test(ua)
  return ios && safari
}

const instalada = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

/** Icono "Compartir" de iOS (cuadro con flecha hacia arriba). */
function IconoCompartir() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12M8 7l4-4 4 4" />
      <path d="M8 11H6.5A1.5 1.5 0 0 0 5 12.5v7A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-7a1.5 1.5 0 0 0-1.5-1.5H16" />
    </svg>
  )
}

export function BannerInstalarPWA() {
  const [modo, setModo] = useState<'ios' | 'android' | null>(null)
  const [evento, setEvento] = useState<EventoInstalar | null>(null)

  useEffect(() => {
    if (esNativa || instalada() || descartadoReciente()) return
    if (esIOSSafari()) {
      const t = setTimeout(() => setModo('ios'), 1200)
      return () => clearTimeout(t)
    }
    const f = (e: Event) => {
      e.preventDefault()
      setEvento(e as EventoInstalar)
      setModo('android')
    }
    window.addEventListener('beforeinstallprompt', f)
    return () => window.removeEventListener('beforeinstallprompt', f)
  }, [])

  if (!modo) return null
  const cerrar = () => {
    localStorage.setItem(CLAVE, String(Date.now()))
    setModo(null)
  }

  return (
    <aside
      aria-label="Instalar NutriFit"
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 mx-auto max-w-md animate-pop-in rounded-3xl border border-neutral-200 bg-card/95 p-4 shadow-lift backdrop-blur-md dark:border-neutral-800 dark:bg-card-dark/95"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-neutral-200 bg-white dark:border-neutral-700">
          <Logo size={34} className="text-graphite" />
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="font-semibold">Instala NutriFit</p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Ábrela como una app, a pantalla completa.</p>
        </div>
        <button type="button" onClick={cerrar} aria-label="Cerrar" className="-mr-1 -mt-1 rounded-full p-1.5 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 hover:text-graphite dark:hover:bg-neutral-800">
          <X size={18} />
        </button>
      </div>
      {modo === 'ios' ? (
        <ol className="mt-4 space-y-2 text-sm">
          <li className="flex items-center gap-3 rounded-2xl bg-neutral-50 px-3 py-2.5 dark:bg-neutral-900">
            <span className="cifra flex h-6 w-6 items-center justify-center rounded-full bg-graphite text-xs font-semibold text-white dark:bg-white dark:text-graphite">1</span>
            <span className="flex-1">
              Toca <strong className="font-medium">Compartir</strong>
            </span>
            <span className="text-[#007AFF]">
              <IconoCompartir />
            </span>
          </li>
          <li className="flex items-center gap-3 rounded-2xl bg-neutral-50 px-3 py-2.5 dark:bg-neutral-900">
            <span className="cifra flex h-6 w-6 items-center justify-center rounded-full bg-graphite text-xs font-semibold text-white dark:bg-white dark:text-graphite">2</span>
            <span className="flex-1">
              y luego <strong className="font-medium">Añadir a la pantalla de inicio</strong>
            </span>
            <SquarePlus size={18} strokeWidth={1.9} className="text-neutral-600 dark:text-neutral-300" />
          </li>
        </ol>
      ) : (
        <div className="mt-4 flex gap-2">
          <Button variant="ghost" block onClick={cerrar}>
            Ahora no
          </Button>
          <Button
            block
            onClick={async () => {
              await evento?.prompt()
              await evento?.userChoice
              cerrar()
            }}
          >
            Instalar
          </Button>
        </div>
      )}
    </aside>
  )
}
