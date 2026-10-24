/**
 * Portada pública (sin sesión): qué es NutriFit, funciones, cómo empezar, instalar y FAQ.
 * Ligera a propósito (Lighthouse 95+): sin dependencias pesadas, imágenes con tamaño fijo
 * y solo la primera captura con prioridad alta.
 */
import { useEffect, useState } from 'react'
import { Logo } from './Logo.tsx'
import { FAQ_LANDING } from '../lib/faqLanding.ts'
import { URL_REPO } from '../lib/config.ts'
import { alCambiarPrompt, detectarPlataforma, instalada, instalarPWA, promptInstalar } from '../lib/instalacion.ts'

const FUNCIONES: { e: string; t: string; d: string }[] = [
  { e: '📸', t: 'De foto a emoji con IA', d: 'Haz una foto del plato: la IA reconoce los alimentos y calcula calorías y macros. La foto no se guarda nunca.' },
  { e: '🏷️', t: 'Código de barras', d: 'Escanea el envase y elige entre más de 300.000 productos con su información nutricional.' },
  { e: '📊', t: 'Calorías y macros', d: 'Proteínas, carbohidratos y grasas frente a tu objetivo, con días de entreno y descanso.' },
  { e: '🔥', t: 'Rachas y logros', d: 'Cada día apuntado suma a tu racha. Desbloquea logros sin agobios ni castigos.' },
  { e: '⌚', t: 'Recordatorios en móvil y reloj', d: 'Avisos por comida solo si aún no la has apuntado, con horas de silencio. Llegan también al reloj.' },
  { e: '🌱', t: 'Comparte tu día', d: 'Una tarjeta bonita con emojis y números para tus historias o el chat. Tú decides qué se ve.' },
  { e: '🔒', t: 'Privacidad de verdad', d: 'Fotos nunca guardadas, datos en la UE, sin anuncios y sin vender nada. Exporta o borra todo cuando quieras.' },
  { e: '💧', t: 'Agua, peso y ayuno', d: 'Vasos de agua en un toque, curva de peso y temporizador de ayuno intermitente.' },
]

const PASOS = [
  { t: 'Entra con tu email', d: 'Sin contraseñas: te llega un código o un enlace.' },
  { t: 'Apunta lo que comes', d: 'Foto, código de barras o una frase como «dos huevos y una tostada».' },
  { t: 'Mira tu día y compártelo', d: 'Calorías, macros, agua y racha de un vistazo. Si quieres, compártelo.' },
]

const enlace = 'font-medium text-graphite underline-offset-4 hover:underline dark:text-white'
const btnPrimario = 'inline-flex min-h-12 items-center justify-center rounded-full bg-graphite px-6 text-base font-semibold text-white transition hover:bg-black focus-visible:outline-offset-2 dark:bg-white dark:text-graphite'
const btnSecundario = 'inline-flex min-h-12 items-center justify-center rounded-full border border-neutral-300 px-6 text-base font-semibold text-graphite transition hover:border-graphite dark:border-neutral-700 dark:text-white'

function Movil({ src, alt, prioridad = false, className = '' }: { src: string; alt: string; prioridad?: boolean; className?: string }) {
  return (
    <div className={`rounded-[2.4rem] border border-neutral-200 bg-white p-2 shadow-[0_30px_60px_-30px_rgb(15_23_42/0.35)] dark:border-neutral-800 dark:bg-neutral-900 ${className}`}>
      <img src={src} alt={alt} width={390} height={844} className="h-auto w-full rounded-[2rem]" loading={prioridad ? 'eager' : 'lazy'} decoding="async" {...{ fetchpriority: prioridad ? 'high' : 'low' }} />
    </div>
  )
}

function BotonInstalar({ onInstruccionesIos }: { onInstruccionesIos: () => void }) {
  const [hayPrompt, setHayPrompt] = useState(() => !!promptInstalar())
  useEffect(() => alCambiarPrompt((e) => setHayPrompt(!!e)), [])
  if (instalada()) return null
  async function pulsar() {
    if (hayPrompt && (await instalarPWA().catch(() => false))) return
    if (detectarPlataforma() === 'ios') onInstruccionesIos()
    else window.location.assign('/descargar')
  }
  return <button type="button" onClick={() => void pulsar()} className={btnSecundario}>Instalar app</button>
}

export default function Landing({ onEntrar }: { onEntrar: () => void }) {
  const [ios, setIos] = useState(false)
  const entrar = (e: React.MouseEvent) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); onEntrar() }
  const mostrarIos = () => { setIos(true); requestAnimationFrame(() => document.getElementById('instalar')?.scrollIntoView({ behavior: 'smooth' })) }
  const anio = new Date().getFullYear()

  return (
    <div className="min-h-dvh bg-white text-graphite dark:bg-bg-dark dark:text-zinc-100">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:shadow">Saltar al contenido</a>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
        <a href="/" aria-label="NutriFit, inicio" className="text-graphite dark:text-white"><Logo size={32} withWordmark /></a>
        <nav aria-label="Principal" className="flex items-center gap-1 text-sm sm:gap-4">
          <a href="#funciones" className="hidden rounded-full px-3 py-2 text-neutral-600 hover:text-graphite sm:inline dark:text-neutral-300 dark:hover:text-white">Funciones</a>
          <a href="#faq" className="hidden rounded-full px-3 py-2 text-neutral-600 hover:text-graphite sm:inline dark:text-neutral-300 dark:hover:text-white">Preguntas</a>
          <a href="/entrar" onClick={entrar} className="rounded-full border border-neutral-300 px-4 py-2 font-semibold hover:border-graphite dark:border-neutral-700" data-testid="landing-entrar">Entrar</a>
        </nav>
      </header>

      <main id="contenido">
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-6 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:pb-24 lg:pt-12">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-mint-500/10 px-3 py-1 text-sm font-medium text-mint-800 dark:text-mint-300">🌱 Gratis · sin anuncios · open source</p>
            <h1 className="mt-5 text-[2.6rem] font-semibold leading-[1.05] tracking-tight sm:text-6xl">Tu nutrición,<br />en equilibrio.</h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-neutral-600 dark:text-neutral-300">Haz una foto de tu plato y NutriFit lo convierte en emojis, calorías y macros. Agua, peso, rachas y recordatorios, sin ruido y sin guardar tus fotos.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="/entrar" onClick={entrar} className={btnPrimario} data-testid="landing-empezar">Empezar gratis</a>
              <BotonInstalar onInstruccionesIos={mostrarIos} />
            </div>
            <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">Sin contraseña. Funciona en Android, iPhone y ordenador.</p>
          </div>
          <div className="relative mx-auto flex w-full max-w-md justify-center lg:max-w-none">
            <div aria-hidden className="absolute inset-x-6 top-10 bottom-0 -z-0 rounded-[3rem] bg-gradient-to-b from-mint-500/15 to-transparent" />
            <Movil src="/landing/hoy.webp" alt="Pantalla Hoy de NutriFit: anillo de calorías, macros y comidas del día" prioridad className="relative z-10 w-[58%] max-w-[17rem]" />
            <Movil src="/landing/compartir.webp" alt="Tarjeta «Compartir mi día» con emojis, calorías, agua y racha" className="relative z-0 -ml-[12%] mt-14 w-[52%] max-w-[15rem] rotate-[4deg]" />
          </div>
        </section>

        {/* Funciones */}
        <section id="funciones" aria-labelledby="t-funciones" className="border-t border-neutral-100 bg-neutral-50/70 py-16 dark:border-neutral-900 dark:bg-neutral-950 lg:py-24">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <h2 id="t-funciones" className="text-3xl font-semibold tracking-tight sm:text-4xl">Todo lo que necesitas. Nada más.</h2>
            <p className="mt-3 max-w-2xl text-neutral-600 dark:text-neutral-300">Pensada para apuntar en segundos y seguir con tu día.</p>
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FUNCIONES.map((f) => (
                <li key={f.t} className="rounded-3xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
                  <span aria-hidden className="text-3xl">{f.e}</span>
                  <h3 className="mt-4 text-lg font-semibold">{f.t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">{f.d}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 3 pasos */}
        <section aria-labelledby="t-pasos" className="py-16 lg:py-24">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <h2 id="t-pasos" className="text-3xl font-semibold tracking-tight sm:text-4xl">Empieza en tres pasos</h2>
            <ol className="mt-10 grid gap-6 md:grid-cols-3">
              {PASOS.map((p, i) => (
                <li key={p.t} className="flex gap-4">
                  <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mint-700 text-lg font-semibold text-white">{i + 1}</span>
                  <div>
                    <h3 className="text-lg font-semibold">{p.t}</h3>
                    <p className="mt-1 text-neutral-600 dark:text-neutral-300">{p.d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Instalar */}
        <section id="instalar" aria-labelledby="t-instalar" className="mx-auto max-w-6xl px-5 pb-16 sm:px-8 lg:pb-24">
          <div className="grid gap-8 rounded-[2rem] bg-graphite p-8 text-white sm:p-12 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 id="t-instalar" className="text-3xl font-semibold tracking-tight sm:text-4xl">Llévala en el móvil</h2>
              <p className="mt-3 text-neutral-300">Se instala desde el navegador en segundos, ocupa poco y abre al instante, incluso sin conexión.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a href="/entrar" onClick={entrar} className="inline-flex min-h-12 items-center rounded-full bg-white px-6 font-semibold text-graphite hover:bg-neutral-100">Crear mi cuenta</a>
                <a href="/descargar" className="inline-flex min-h-12 items-center rounded-full border border-white/30 px-6 font-semibold hover:border-white">Android y ordenador</a>
              </div>
            </div>
            <div className={`rounded-3xl bg-white/5 p-6 ring-1 ring-white/10 ${ios ? 'ring-2 ring-mint-400' : ''}`}>
              <h3 className="font-semibold">En iPhone o iPad (Safari)</h3>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-neutral-200">
                <li>Abre <span className="font-medium text-white">nutri.trujillomingorance.com</span> en Safari.</li>
                <li>Pulsa <span className="font-medium text-white">Compartir</span> (el cuadrado con la flecha).</li>
                <li>Elige <span className="font-medium text-white">Añadir a pantalla de inicio</span> y confirma.</li>
              </ol>
              <h3 className="mt-5 font-semibold">En Android u ordenador</h3>
              <p className="mt-2 text-neutral-200">Pulsa «Instalar app» arriba o usa el menú del navegador › Instalar.</p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" aria-labelledby="t-faq" className="border-t border-neutral-100 py-16 dark:border-neutral-900 lg:py-24">
          <div className="mx-auto max-w-3xl px-5 sm:px-8">
            <h2 id="t-faq" className="text-3xl font-semibold tracking-tight sm:text-4xl">Preguntas frecuentes</h2>
            <div className="mt-8 divide-y divide-neutral-200 border-y border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
              {FAQ_LANDING.map((f) => (
                <details key={f.p} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-medium">
                    {f.p}
                    <span aria-hidden className="text-2xl leading-none text-neutral-400 transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 leading-relaxed text-neutral-600 dark:text-neutral-300">{f.r}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-neutral-100 dark:border-neutral-900">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-sm text-neutral-600 sm:flex-row sm:items-center sm:justify-between sm:px-8 dark:text-neutral-400">
          <p>© {anio} NutriFit · Hecho en España por Alberto Trujillo Mingorance</p>
          <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-2">
            <a href="/privacidad" className={enlace}>Privacidad</a>
            <a href="/legal" className={enlace}>Legal</a>
            <a href="/descargar" className={enlace}>Descargar</a>
            <a href={URL_REPO} rel="noopener" className={enlace}>Código en GitHub</a>
          </nav>
        </div>
      </footer>
    </div>
  )
}
