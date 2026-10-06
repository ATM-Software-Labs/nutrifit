/**
 * «Descarga la app»: bloque reutilizable (login, /descargar y barra lateral).
 *  · Escritorio → QR a /descargar («Escanéalo con tu móvil»). El codificador
 *    va en un chunk aparte (el mismo que usa el login con QR).
 *  · Android → «Descargar APK» (versión y tamaño de GitHub si responde) y, si
 *    el navegador lo permite, instalar la app web.
 *  · iPhone/iPad → «Añadir a pantalla de inicio»: diálogo nativo si existe;
 *    si no (Safari), los dos pasos a mano.
 * No se muestra dentro del APK ni si la PWA ya está instalada.
 */
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Download, SquarePlus } from 'lucide-react'
import { api } from '../lib/api.ts'
import { URL_APK } from '../lib/config.ts'
import { alCambiarPrompt, detectarPlataforma, formatoMB, instalarPWA, ofrecerDescarga, promptInstalar, URL_DESCARGAR, type Plataforma } from '../lib/instalacion.ts'
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
      <QrSvg texto={URL_DESCARGAR} tamano={tamano} titulo="Código QR para descargar NutriFit en el móvil" />
    </Suspense>
  )
}

function usePrompt() {
  const [hay, setHay] = useState(() => !!promptInstalar())
  useEffect(() => alCambiarPrompt((e) => setHay(!!e)), [])
  return hay
}

function BotonAPK() {
  const [info, setInfo] = useState<string | null>(null)
  useEffect(() => {
    let vivo = true
    api
      .versionApp()
      .then((r) => {
        const partes = [r.version, formatoMB(r.tamano)].filter(Boolean)
        if (vivo && partes.length) setInfo(partes.join(' · '))
      })
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [])
  return (
    <a
      href={URL_APK}
      download="NutriFit.apk"
      className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-mint-700/30 bg-mint-50 px-5 text-[15px] font-semibold text-mint-800 transition hover:bg-mint-100 active:scale-[0.98] dark:border-mint-400/30 dark:bg-mint-950 dark:text-mint-200 dark:hover:bg-mint-900"
    >
      <Download size={18} strokeWidth={2} aria-hidden="true" />
      <span>Descargar APK</span>
      {info && <span className="cifra text-sm font-medium text-mint-700/70 dark:text-mint-300/70">{info}</span>}
    </a>
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
  const hayPrompt = usePrompt()
  const [pasos, setPasos] = useState(false)
  const anadirInicio = async () => {
    if (!(await instalarPWA())) setPasos((v) => !v)
  }
  if (plataforma === 'android') {
    return (
      <div className="space-y-2">
        <BotonAPK />
        {hayPrompt && (
          <button type="button" onClick={() => void instalarPWA()} className="h-11 w-full rounded-2xl text-[15px] font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800">
            O instálala como app web
          </button>
        )}
      </div>
    )
  }
  return (
    <div>
      <button
        type="button"
        onClick={() => void anadirInicio()}
        aria-expanded={hayPrompt ? undefined : pasos}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-mint-700/30 bg-mint-50 px-5 text-[15px] font-semibold text-mint-800 transition hover:bg-mint-100 active:scale-[0.98] dark:border-mint-400/30 dark:bg-mint-950 dark:text-mint-200 dark:hover:bg-mint-900"
      >
        <SquarePlus size={18} strokeWidth={2} aria-hidden="true" />
        Añadir a pantalla de inicio
      </button>
      {pasos && <PasosIOS />}
    </div>
  )
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
          Android (APK) · iPhone (app web)
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
              Descarga la app
            </h2>
            <p className="mt-1 text-sm font-medium text-mint-700 dark:text-mint-400">Escanéalo con tu móvil</p>
            <p className="mt-1.5 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">Android (APK) o iPhone (app web), gratis y sin anuncios.</p>
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
            Descarga la app
          </h2>
          <p className="mb-4 mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {plataforma === 'android' ? 'Instala NutriFit en tu Android: gratis, sin anuncios.' : 'Úsala como una app más en tu iPhone, a pantalla completa.'}
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
