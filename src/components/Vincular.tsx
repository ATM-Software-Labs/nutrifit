/**
 * Móvil (con sesión), tras escanear el QR del ordenador:
 * «¿Iniciar sesión en este ordenador?» con navegador/sistema, ubicación
 * aproximada, hora y el código corto que también muestra el PC (anti-phishing).
 */
import { useEffect, useState } from 'react'
import { CircleCheck, CircleX, Monitor, ShieldAlert } from 'lucide-react'
import { Logo } from './Logo.tsx'
import { Button } from './ui/Button.tsx'
import { Spinner } from './ui/Spinner.tsx'
import { api, ApiError } from '../lib/api.ts'
import type { InfoVinculo } from '../lib/tipos.ts'

type Estado =
  | { fase: 'cargando' }
  | { fase: 'pregunta'; info: InfoVinculo }
  | { fase: 'hecho'; aprobado: boolean }
  | { fase: 'error'; mensaje: string }

const hora = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' })

export default function Vincular({ id, onTerminar }: { id: string | null; onTerminar: () => void }) {
  const [estado, setEstado] = useState<Estado>(id ? { fase: 'cargando' } : { fase: 'error', mensaje: 'Abre esta pantalla escaneando el código QR que muestra NutriFit en el ordenador.' })
  const [enviando, setEnviando] = useState<'aprobar' | 'rechazar' | null>(null)
  const [ahora, setAhora] = useState(() => Date.now())

  useEffect(() => {
    if (!id) return
    let vivo = true
    api
      .qrInfo(id)
      .then((info) => vivo && setEstado({ fase: 'pregunta', info }))
      .catch((e: unknown) => vivo && setEstado({ fase: 'error', mensaje: e instanceof Error ? e.message : 'No se pudo cargar la solicitud.' }))
    return () => {
      vivo = false
    }
  }, [id])

  useEffect(() => {
    if (estado.fase !== 'pregunta') return
    const t = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(t)
  }, [estado.fase])

  async function decidir(aprobar: boolean) {
    if (!id) return
    setEnviando(aprobar ? 'aprobar' : 'rechazar')
    try {
      await api.qrDecidir(id, aprobar)
      setEstado({ fase: 'hecho', aprobado: aprobar })
    } catch (e) {
      setEstado({ fase: 'error', mensaje: e instanceof ApiError || e instanceof Error ? e.message : 'No se pudo completar.' })
    } finally {
      setEnviando(null)
    }
  }

  const info = estado.fase === 'pregunta' ? estado.info : null
  const restante = info ? Math.max(0, Math.ceil(info.expira_en - ahora / 1000)) : 0
  const caducado = !!info && restante === 0
  const hace = info ? Math.max(0, Math.round(ahora / 1000 - info.creado_en)) : 0

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col px-6 pb-8 pt-[max(3rem,env(safe-area-inset-top))]">
      <Logo size={40} className="text-graphite dark:text-neutral-100" />
      <div className="flex flex-1 flex-col justify-center py-8">
        {estado.fase === 'cargando' && (
          <div className="flex justify-center" aria-busy="true" aria-label="Cargando solicitud">
            <Spinner className="h-8 w-8 text-neutral-400" />
          </div>
        )}

        {info && (
          <div className="animate-pop-in">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-mint-50 text-mint-700 dark:bg-mint-950 dark:text-mint-400">
              <Monitor size={26} strokeWidth={1.75} />
            </span>
            <h1 className="mt-6 text-[1.75rem] font-semibold leading-tight tracking-tight">¿Iniciar sesión en este ordenador?</h1>

            <dl className="tarjeta mt-6 divide-y divide-neutral-100 text-sm dark:divide-neutral-800">
              <div className="flex justify-between gap-4 px-4 py-3">
                <dt className="text-neutral-500 dark:text-neutral-400">Dispositivo</dt>
                <dd className="text-right font-medium">{info.dispositivo}</dd>
              </div>
              {info.ubicacion && (
                <div className="flex justify-between gap-4 px-4 py-3">
                  <dt className="text-neutral-500 dark:text-neutral-400">Ubicación aprox.</dt>
                  <dd className="text-right font-medium">{info.ubicacion}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4 px-4 py-3">
                <dt className="text-neutral-500 dark:text-neutral-400">Solicitado</dt>
                <dd className="cifra text-right font-medium">
                  {hora.format(info.creado_en * 1000)} · hace {hace < 60 ? `${hace} s` : `${Math.floor(hace / 60)} min`}
                </dd>
              </div>
            </dl>

            <div className="mt-4 rounded-2xl bg-neutral-50 p-4 text-center dark:bg-neutral-900">
              <p className="etiqueta">Código que debe ver en el ordenador</p>
              <p className="cifra mt-1 font-mono text-4xl font-semibold tracking-[0.35em]">{info.codigo}</p>
            </div>

            <p className="mt-4 flex gap-2.5 rounded-2xl border border-fats/30 bg-fats-soft/60 px-4 py-3 text-sm text-amber-900 dark:border-fats/20 dark:bg-fats/10 dark:text-amber-200">
              <ShieldAlert size={18} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>Aprueba solo si estás delante de ese ordenador y muestra el mismo código. Si alguien te ha enviado este QR, pulsa «Rechazar».</span>
            </p>

            <div className="mt-6 space-y-2">
              <Button size="lg" block disabled={caducado || enviando === 'rechazar'} loading={enviando === 'aprobar'} onClick={() => void decidir(true)}>
                {caducado ? 'Solicitud caducada' : 'Aprobar'}
              </Button>
              <Button variant="outline" size="lg" block disabled={enviando === 'aprobar'} loading={enviando === 'rechazar'} onClick={() => (caducado ? onTerminar() : void decidir(false))}>
                {caducado ? 'Volver' : 'Rechazar'}
              </Button>
            </div>
            {!caducado && <p className="cifra mt-3 text-center text-xs text-neutral-500 dark:text-neutral-400">Caduca en {Math.floor(restante / 60)}:{String(restante % 60).padStart(2, '0')}</p>}
          </div>
        )}

        {estado.fase === 'hecho' && (
          <div className="animate-pop-in text-center" role="status">
            <span className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${estado.aprobado ? 'bg-mint-50 text-mint-700 dark:bg-mint-950 dark:text-mint-400' : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-900'}`}>
              {estado.aprobado ? <CircleCheck size={28} strokeWidth={1.75} /> : <CircleX size={28} strokeWidth={1.75} />}
            </span>
            <h1 className="mt-6 text-2xl font-semibold tracking-tight">{estado.aprobado ? 'Ordenador conectado' : 'Acceso rechazado'}</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-neutral-500 dark:text-neutral-400">
              {estado.aprobado ? 'En unos segundos NutriFit se abrirá en el ordenador con tu cuenta.' : 'El ordenador no ha recibido acceso a tu cuenta.'}
            </p>
            <Button className="mt-8" size="lg" block onClick={onTerminar}>
              Ir a NutriFit
            </Button>
          </div>
        )}

        {estado.fase === 'error' && (
          <div className="animate-pop-in text-center" role="alert">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-500 dark:bg-neutral-900">
              <Monitor size={26} strokeWidth={1.75} />
            </span>
            <p className="mt-6 text-[15px] leading-relaxed text-neutral-600 dark:text-neutral-300">{estado.mensaje}</p>
            <Button className="mt-8" variant="outline" size="lg" block onClick={onTerminar}>
              Ir a NutriFit
            </Button>
          </div>
        )}
      </div>
    </main>
  )
}
