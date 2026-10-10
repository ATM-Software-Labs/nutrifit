/**
 * /descargar — instalación nativa de la PWA (Chrome) y pasos de Safari.
 * Detecta la plataforma y pone primero la recomendada.
 */
import { useMemo, type ReactNode } from 'react'
import { ArrowLeft, ExternalLink, Globe, Smartphone, Download } from 'lucide-react'
import { Logo } from './Logo.tsx'
import { cx } from './ui/cx.ts'
import { GITHUB_REPO, URL_REPO } from '../lib/config.ts'
import { detectarPlataforma } from '../lib/instalacion.ts'
import { BotonInstalar, QrDescarga } from './BloqueDescarga.tsx'


function Insignia({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-mint-50 px-2.5 py-1 text-2xs font-semibold uppercase tracking-wider text-mint-700 dark:bg-mint-950 dark:text-mint-300">{children}</span>
}

function Tarjeta({ icono, titulo, recomendada, children }: { icono: ReactNode; titulo: string; recomendada?: string; children: ReactNode }) {
  return (
    <section className={cx('tarjeta p-5 sm:p-6', recomendada && 'ring-1 ring-mint/40')} aria-label={titulo}>
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-100 text-graphite dark:bg-neutral-800 dark:text-neutral-100">{icono}</span>
        <h2 className="flex-1 text-lg font-semibold tracking-tight">{titulo}</h2>
        {recomendada && <Insignia>{recomendada}</Insignia>}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}

/* ------------------------------------------------ Ilustraciones (SVG puro) */
function Movil({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 100 168" className="h-auto w-full" aria-hidden="true">
      <rect x="4" y="2" width="92" height="164" rx="16" className="fill-white stroke-neutral-300 dark:fill-neutral-900 dark:stroke-neutral-700" strokeWidth="2" />
      <rect x="38" y="9" width="24" height="6" rx="3" className="fill-neutral-200 dark:fill-neutral-700" />
      {children}
    </svg>
  )
}
const Linea = ({ y, w = 60, x = 20 }: { y: number; w?: number; x?: number }) => <rect x={x} y={y} width={w} height="5" rx="2.5" className="fill-neutral-100 dark:fill-neutral-800" />
const Toque = ({ cx: x, cy: y }: { cx: number; cy: number }) => (
  <g>
    <circle cx={x} cy={y} r="11" fill="#10B981" opacity="0.18" />
    <circle cx={x} cy={y} r="6.5" fill="none" stroke="#10B981" strokeWidth="2" />
  </g>
)
const IconoCompartir = ({ x, y, s = 1, color = '#007AFF' }: { x: number; y: number; s?: number; color?: string }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M0 -6v8M-3 -3l3-3 3 3" />
    <path d="M-3 0h-1.5v6.5h9V0H3" />
  </g>
)

function PasoSafari() {
  return (
    <Movil>
      <rect x="12" y="22" width="76" height="11" rx="5.5" className="fill-neutral-100 dark:fill-neutral-800" />
      <text x="50" y="30" textAnchor="middle" className="fill-neutral-500 text-[6px]">nutri.trujillomingorance.com</text>
      <g transform="translate(50 86)">
        <circle r="22" fill="#007AFF" opacity="0.1" />
        <circle r="16" fill="none" stroke="#007AFF" strokeWidth="2" />
        <path d="M5 -5 L2 2 L-5 5 L-2 -2 Z" fill="#007AFF" />
      </g>
      <text x="50" y="128" textAnchor="middle" className="fill-neutral-500 text-[8px] font-medium">Safari</text>
    </Movil>
  )
}
function PasoCompartir() {
  return (
    <Movil>
      <Linea y={30} />
      <Linea y={42} w={48} />
      <Linea y={54} w={56} />
      <rect x="10" y="138" width="80" height="20" rx="6" className="fill-neutral-50 dark:fill-neutral-800/70" />
      {[22, 36, 64, 78].map((x) => (
        <rect key={x} x={x - 3} y="145" width="6" height="6" rx="1.5" className="fill-neutral-300 dark:fill-neutral-600" />
      ))}
      <Toque cx={50} cy={148} />
      <IconoCompartir x={50} y={148} s={0.9} />
    </Movil>
  )
}
function PasoAnadir() {
  return (
    <Movil>
      <rect x="4" y="66" width="92" height="100" rx="14" className="fill-neutral-50 dark:fill-neutral-800" />
      <rect x="40" y="72" width="20" height="3" rx="1.5" className="fill-neutral-300 dark:fill-neutral-600" />
      {[84, 102].map((y) => (
        <g key={y}>
          <rect x="12" y={y} width="76" height="14" rx="4" className="fill-white dark:fill-neutral-900" />
          <Linea y={y + 4.5} w={36} x={18} />
        </g>
      ))}
      <rect x="12" y="120" width="76" height="16" rx="4" fill="#10B981" opacity="0.12" stroke="#10B981" strokeWidth="1.2" />
      <text x="18" y="130.5" className="fill-graphite text-[6.2px] font-semibold dark:fill-white">Añadir a inicio</text>
      <g transform="translate(79 128)" fill="none" stroke="#10B981" strokeWidth="1.4" strokeLinecap="round">
        <rect x="-4.5" y="-4.5" width="9" height="9" rx="2" />
        <path d="M0 -2.2v4.4M-2.2 0h4.4" />
      </g>
    </Movil>
  )
}
function PasoInicio() {
  const celdas = Array.from({ length: 12 }, (_, i) => ({ x: 17 + (i % 4) * 18, y: 30 + Math.floor(i / 4) * 22 }))
  return (
    <Movil>
      {celdas.map((c, i) =>
        i === 9 ? null : <rect key={i} x={c.x} y={c.y} width="12" height="12" rx="3.5" className="fill-neutral-100 dark:fill-neutral-800" />,
      )}
      <g transform={`translate(${celdas[9]!.x} ${celdas[9]!.y})`}>
        <circle cx="6" cy="6" r="12" fill="#10B981" opacity="0.15" />
        <rect width="12" height="12" rx="3.5" fill="#fff" stroke="#10B981" strokeWidth="1" />
        <circle cx="6" cy="6.5" r="3.2" fill="none" stroke="#10B981" strokeWidth="1.1" />
        <path d="M6 6.5V4.2M6 4.2c0-1 .8-1.6 1.7-1.6" fill="none" stroke="#10B981" strokeWidth="0.9" strokeLinecap="round" />
      </g>
      <text x={celdas[9]!.x + 6} y={celdas[9]!.y + 20} textAnchor="middle" className="fill-neutral-500 text-[5px] font-medium">NutriFit</text>
    </Movil>
  )
}

const PASOS_IOS = [
  { svg: <PasoSafari />, titulo: 'Abre la web en Safari', texto: 'nutri.trujillomingorance.com' },
  { svg: <PasoCompartir />, titulo: 'Toca Compartir', texto: 'El cuadrado con la flecha hacia arriba' },
  { svg: <PasoAnadir />, titulo: '«Añadir a pantalla de inicio»', texto: 'Desliza hacia abajo si no lo ves' },
  { svg: <PasoInicio />, titulo: 'Toca «Añadir»', texto: 'NutriFit aparecerá como una app más' },
]

function Android({ recomendada }: { recomendada?: string }) {
  return (
    <Tarjeta icono={<Smartphone size={20} strokeWidth={1.75} />} titulo="Android" recomendada={recomendada}>
      <p className="mb-4 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
        Se instala desde Chrome, a pantalla completa y con el motor del navegador. También puedes descargar el archivo APK directamente.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <BotonInstalar />
        </div>
        <a
          href="/NutriFit.apk"
          download="NutriFit.apk"
          className="flex flex-1 h-12 items-center justify-center gap-2 rounded-2xl bg-neutral-800 text-[15px] font-semibold text-white transition hover:bg-neutral-700"
        >
          <Download size={18} /> Descargar APK
        </a>
      </div>
    </Tarjeta>
  )
}


function Iphone({ recomendada }: { recomendada?: string }) {
  return (
    <Tarjeta icono={<Globe size={20} strokeWidth={1.75} />} titulo="iPhone y iPad" recomendada={recomendada}>
      <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">Instálala como app web desde Safari: sin App Store, a pantalla completa y siempre actualizada.</p>
      <ol className="mt-5 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4">
        {PASOS_IOS.map((p, i) => (
          <li key={p.titulo} className="text-center">
            <div className="mx-auto w-24">{p.svg}</div>
            <p className="mt-2 text-sm font-semibold leading-snug">
              <span className="cifra mr-1 text-mint-700 dark:text-mint-400">{i + 1}.</span>
              {p.titulo}
            </p>
            <p className="mt-0.5 text-xs leading-snug text-neutral-500 dark:text-neutral-400">{p.texto}</p>
          </li>
        ))}
      </ol>
    </Tarjeta>
  )
}

export default function SeccionDescargas() {
  const plataforma = useMemo(() => detectarPlataforma(), [])
  const tarjetas =
    plataforma === 'ios'
      ? [<Iphone key="i" recomendada="Tu dispositivo" />, <Android key="a" />]
      : plataforma === 'android'
        ? [<Android key="a" recomendada="Tu dispositivo" />, <Iphone key="i" />]
        : [<Android key="a" />, <Iphone key="i" />]

  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-5 pb-16 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between py-3">
        <a href="/" className="-ml-2 flex items-center gap-1.5 rounded-full px-2 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800">
          <ArrowLeft size={18} /> Volver
        </a>
        <Logo size={30} className="text-graphite dark:text-neutral-100" />
      </header>

      <h1 className="mt-6 text-[2rem] font-semibold leading-tight tracking-tight">Instala NutriFit</h1>
      {plataforma === 'escritorio' ? (
                  <section aria-label="Descargar en el móvil" className="tarjeta mt-6 flex flex-col items-center gap-6 p-6 sm:flex-row">
          <div className="shrink-0 rounded-2xl border border-neutral-200 p-2 dark:border-neutral-800">
            <QrDescarga tamano={168} />
          </div>
          <div className="flex-1">
            <p className="text-lg font-semibold tracking-tight">Escanea el código o instala en tu PC</p>
            <p className="mt-2 text-[15px] leading-relaxed text-neutral-500 dark:text-neutral-400">
              Apunta con la cámara de tu móvil para instalar la app, o pulsa el botón de abajo para instalarla directamente en este ordenador (Windows/Mac).
            </p>
            <div className="mt-5 w-full max-w-xs">
              <BotonInstalar />
            </div>
          </div>
        </section>
      ) : (
        <p className="mt-2 text-[15px] leading-relaxed text-neutral-500 dark:text-neutral-400">Gratis, sin anuncios y de código abierto.</p>
      )}

      <div className="mt-8 space-y-4">{tarjetas}</div>

      <section className="mt-4 flex flex-col gap-4 rounded-2xl border border-dashed border-neutral-300 p-5 sm:flex-row sm:items-center dark:border-neutral-700" aria-label="Código fuente">
        <div className="flex-1">
          <h2 className="font-semibold">Código abierto</h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Revisa el código o despliégalo en tu dominio.</p>
          <span className="mt-3 inline-flex overflow-hidden rounded-md text-2xs font-semibold" aria-label="Licencia MIT">
            <span className="bg-graphite px-2 py-1 text-white dark:bg-neutral-700">licencia</span>
            <span className="bg-mint-700 px-2 py-1 text-white">MIT</span>
          </span>
        </div>
        <a
          href={URL_REPO}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-neutral-200 px-4 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
        >
          <ExternalLink size={16} /> {GITHUB_REPO}
        </a>
      </section>
    </div>
  )
}
