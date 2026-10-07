/**
 * Instalación de la PWA (login, /descargar y barra lateral).
 *  · Chrome/Android con beforeinstallprompt → ventana nativa al pulsar.
 *  · iPhone/iPad, o Chrome sin ese evento → guía Compartir → Añadir a inicio.
 *  · Escritorio → QR a /descargar. El codificador va en un chunk aparte.
 * No se muestra dentro de la app nativa ni si ya está instalada.
 */
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { SquarePlus } from 'lucide-react'
import { alCambiarPrompt, detectarPlataforma, instalada, instalarPWA, ofrecerDescarga, promptInstalar, URL_DESCARGAR, type Plataforma } from '../lib/instalacion.ts'
import { cx } from './ui/cx.ts'

const QrSvg = lazy(() => import('./QrSvg.tsx').then((m) => ({ default: m.QrSvg })))

/** Icono «Compartir» de iOS (cuadro con flecha hacia arriba). */
export function IconoCompartirIOS({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12M8 7l4-4 4 4" />
      <path d="M8 11H6.5A1.5 1.5 0 0 0 5 12.5v7A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-7a1.5 1.5 0 0 0-1.5-1.5H16" />
    </svg>
  )
}

export function QrDescarga({ tamano = 132 }: { tamano?: number }) {
  return (
    <Suspense fallback={<div style={{ width: tamano, height: tamano }} className="animate-pulse rounded-2xl bg-neutral-100 dark:bg-neutral-800" />}>
      <QrSvg texto={URL_DESCARGAR} tamano={tamano} titulo="Código QR para instalar NutriFit en el móvil" />
    </Suspense>
  )
}

function usePrompt() {
  const [hay, setHay] = useState(() => !!promptInstalar())
  useEffect(() => alCambiarPrompt((e) => setHay(!!e)), [])
  return hay
}

const CLASE_BOTON =
  'flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-mint-700/30 bg-mint-50 px-5 text-[15px] font-semibold text-mint-800 transition hover:bg-mint-100 active:scale-[0.98] dark:border-mint-400/30 dark:bg-mint-950 dark:text-mint-200 dark:hover:bg-mint-900'

/** Abre el diálogo nativo de Chrome o, si no existe, la guía de pantalla de inicio. */
export function BotonInstalar() {
  const hayPrompt = usePrompt()
  const [guia, setGuia] = useState(false)
  const plataforma = useMemo(() => detectarPlataforma(), [])
  if (instalada()) return <p className="text-sm text-neutral-500 dark:text-neutral-400">NutriFit ya está instalada en este dispositivo.</p>

  const pulsar = async () => {
    if (plataforma !== 'ios' && (await instalarPWA())) return
    setGuia(true)
  }

  return (
    <div>
      <button type="button" onClick={() => void pulsar()} className={CLASE_BOTON}>
        <SquarePlus size={18} strokeWidth={2} aria-hidden="true" />
        Instalar
      </button>
      {guia && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-950/40 p-4 sm:items-center" role="presentation" onClick={() => setGuia(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="guia-instalar"
            className="w-full max-w-md rounded-3xl border border-neutral-200 bg-card p-5 shadow-lift dark:border-neutral-800 dark:bg-card-dark"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="guia-instalar" className="text-lg font-semibold tracking-tight">
              {plataforma === 'ios' ? 'Añadir a la pantalla de inicio' : 'Instalar desde Chrome'}
            </h3>
            {plataforma === 'ios' ? (
              <PasosIOS />
            ) : (
              <p className="mt-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
                {hayPrompt
                  ? 'Chrome no ha podido abrir la instalación. Vuelve a pulsar Instalar.'
                  : 'Abre el menú de Chrome (⋮) y elige «Instalar app» o «Añadir a pantalla de inicio».'}
              </p>
            )}
            <button type="button" onClick={() => setGuia(false)} className="mt-4 h-11 w-full rounded-2xl bg-graphite text-sm font-semibold text-white dark:bg-white dark:text-graphite">
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function PasosIOS() {
  return (
    <ol className="mt-3 space-y-2 text-sm" aria-label="Cómo añadir NutriFit a la pantalla de inicio">
      <li className="flex items-center gap-3 rounded-2xl bg-neutral-50 px-3 py-2.5 dark:bg-neutral-900">
        <span className="cifra flex h-6 w-6 items-center justify-center rounded-full bg-graphite text-xs font-semibold text-white dark:bg-white dark:text-graphite">1</span>
        <span className="flex-1">
          En Safari, toca <strong className="font-medium">Compartir</strong>
        </span>
        <span className="text-[#007AFF]">
          <IconoCompartirIOS />
        </span>
      </li>
      <li className="flex items-center gap-3 rounded-2xl bg-neutral-50 px-3 py-2.5 dark:bg-neutral-900">
        <span className="cifra flex h-6 w-6 items-center justify-center rounded-full bg-graphite text-xs font-semibold text-white dark:bg-white dark:text-graphite">2</span>
        <span className="flex-1">
          Elige <strong className="font-medium">Añadir a pantalla de inicio</strong>
        </span>
        <SquarePlus size={18} strokeWidth={1.9} className="text-neutral-600 dark:text-neutral-300" aria-hidden="true" />
      </li>
    </ol>
  )
}

function BotonesMovil({ plataforma }: { plataforma: Exclude<Plataforma, 'escritorio'> }) {
  return <BotonInstalar key={plataforma} />
}

/**
 * variante «tarjeta»: bloque completo (login y /descargar).
 * variante «lateral»: QR pequeño para la barra lateral de escritorio.
 */
export function BloqueDescarga({ variante = 'tarjeta', className, conEnlace = true }: { variante?: 'tarjeta' | 'lateral'; className?: string; conEnlace?: boolean }) {
  const plataforma = useMemo(() => detectarPlataforma(), [])
  const mostrar = useMemo(ofrecerDescarga, [])
  if (!mostrar) return null

  if (variante === 'lateral') {
    return (
      <div className={cx('rounded-2xl border border-neutral-200 p-3 text-center dark:border-neutral-800', className)}>
        <div className="mx-auto w-fit">
          <QrDescarga tamano={120} />
        </div>
        <p className="mt-2 text-xs font-medium">Escanéalo con tu móvil</p>
        <a href="/descargar" className="mt-0.5 block text-2xs text-neutral-500 hover:text-graphite dark:text-neutral-400 dark:hover:text-white">
          Instalar en el móvil
        </a>
      </div>
    )
  }

  return (
    <section aria-labelledby="titulo-descarga" className={cx('tarjeta p-5', className)}>
      {plataforma === 'escritorio' ? (
        <div className="flex items-center gap-5">
          <div className="shrink-0 rounded-2xl border border-neutral-200 p-1.5 dark:border-neutral-800">
            <QrDescarga tamano={112} />
          </div>
          <div className="min-w-0">
            <h2 id="titulo-descarga" className="text-lg font-semibold tracking-tight">
              Instala la app
            </h2>
            <p className="mt-1 text-sm font-medium text-mint-700 dark:text-mint-400">Escanéalo con tu móvil</p>
            <p className="mt-1.5 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">Se abre a pantalla completa desde Chrome o Safari, gratis y sin anuncios.</p>
            {conEnlace && (
              <a href="/descargar" className="mt-2 inline-block text-sm font-medium text-graphite underline decoration-neutral-300 underline-offset-4 hover:decoration-mint dark:text-neutral-100 dark:decoration-neutral-600">
                Ver todas las opciones
              </a>
            )}
          </div>
        </div>
      ) : (
        <>
          <h2 id="titulo-descarga" className="text-lg font-semibold tracking-tight">
            Instala la app
          </h2>
          <p className="mb-4 mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {plataforma === 'android' ? 'Chrome la instala como una app, a pantalla completa.' : 'Úsala como una app más en tu iPhone, a pantalla completa.'}
          </p>
          <BotonesMovil plataforma={plataforma} />
          {conEnlace && (
            <a href="/descargar" className="mt-3 block text-center text-sm font-medium text-neutral-500 hover:text-graphite dark:text-neutral-400 dark:hover:text-white">
              Más opciones de instalación
            </a>
          )}
        </>
      )}
    </section>
  )
}

export default BloqueDescarga
