/**
 * Entrar en el ordenador escaneando un QR con el móvil (donde ya hay sesión).
 *
 *  1. El PC genera un secreto aleatorio (32 B) que NUNCA sale del navegador salvo
 *     en sus propias consultas, y registra su SHA-256 → /api/auth/qr/crear.
 *  2. Muestra el QR (https://…/vincular#id) y un código corto para comparar.
 *  3. Consulta /api/auth/qr/estado cada 2 s con {id, secreto}: solo quien tiene
 *     el secreto recibe la cookie de sesión cuando el móvil aprueba.
 *  Caduca a los 2 min; se renueva solo unas pocas veces y luego pide un clic.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { CircleCheck, RefreshCw, ShieldCheck, Smartphone } from 'lucide-react'
import { Button } from './ui/Button.tsx'
import { Spinner } from './ui/Spinner.tsx'
import { QrSvg } from './QrSvg.tsx'
import { api, ApiError } from '../lib/api.ts'
import type { Usuario } from '../lib/tipos.ts'

const INTERVALO_MS = 2000
const RENOVACIONES_AUTO = 4

type Estado =
  | { fase: 'cargando' }
  | { fase: 'listo'; id: string; codigo: string; url: string; expira: number }
  | { fase: 'aprobado' }
  | { fase: 'parado'; mensaje: string }

function base64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
async function sha256Hex(texto: string) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto)))
  return Array.from(h, (b) => b.toString(16).padStart(2, '0')).join('')
}

export default function LoginQR({ onEntrar }: { onEntrar: (u: Usuario, perfilCompleto: boolean) => void }) {
  const [estado, setEstado] = useState<Estado>({ fase: 'cargando' })
  const [ahora, setAhora] = useState(() => Date.now())
  const secreto = useRef('')
  const renovaciones = useRef(0)
  const montado = useRef(true)

  const generar = useCallback(async () => {
    setEstado({ fase: 'cargando' })
    try {
      secreto.current = base64url(crypto.getRandomValues(new Uint8Array(32)))
      const r = await api.qrCrear(await sha256Hex(secreto.current))
      if (montado.current) setEstado({ fase: 'listo', id: r.id, codigo: r.codigo, url: r.url, expira: r.expira * 1000 })
    } catch (e) {
      if (montado.current) setEstado({ fase: 'parado', mensaje: e instanceof Error ? e.message : 'No se pudo generar el código QR.' })
    }
  }, [])

  useEffect(() => {
    montado.current = true
    void generar()
    return () => {
      montado.current = false
    }
  }, [generar])

  // Sondeo del estado mientras el QR está vigente y la pestaña visible.
  const id = estado.fase === 'listo' ? estado.id : null
  const expira = estado.fase === 'listo' ? estado.expira : 0
  useEffect(() => {
    if (!id) return
    const ctrl = new AbortController()
    let timer = 0
    const siguiente = (ms = INTERVALO_MS) => {
      timer = window.setTimeout(consultar, ms)
    }
    const caducado = () => {
      if (renovaciones.current < RENOVACIONES_AUTO && document.visibilityState === 'visible') {
        renovaciones.current++
        void generar()
      } else setEstado({ fase: 'parado', mensaje: 'El código QR ha caducado.' })
    }
    async function consultar() {
      setAhora(Date.now())
      if (Date.now() >= expira) return caducado()
      if (document.visibilityState !== 'visible') return siguiente()
      try {
        const r = await api.qrEstado(id!, secreto.current, ctrl.signal)
        if (r.estado === 'aprobado') {
          setEstado({ fase: 'aprobado' })
          secreto.current = ''
          onEntrar(r.usuario, r.perfilCompleto)
        } else if (r.estado === 'pendiente') siguiente()
        else if (r.estado === 'rechazado') setEstado({ fase: 'parado', mensaje: 'Se ha rechazado el acceso desde el móvil.' })
        else caducado()
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
        siguiente(e instanceof ApiError && e.status === 429 ? Math.max(5, e.reintentarEn ?? 10) * 1000 : 5000)
      }
    }
    siguiente()
    return () => {
      ctrl.abort()
      clearTimeout(timer)
    }
  }, [id, expira, generar, onEntrar])

  // Cuenta atrás visible (1 s).
  useEffect(() => {
    if (!id) return
    const t = window.setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(t)
  }, [id])

  const restante = Math.max(0, Math.ceil((expira - ahora) / 1000))

  return (
    <div className="tarjeta p-8 xl:p-10">
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-mint-50 text-mint-700 dark:bg-mint-950 dark:text-mint-400">
          <Smartphone size={22} strokeWidth={1.75} />
        </span>
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Entrar con el móvil</h2>
          <p className="mt-1 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">Sin email: escanea el código con el móvil en el que ya usas NutriFit.</p>
        </div>
      </div>

      <div className="mt-8 flex flex-col items-center gap-8 xl:flex-row xl:items-start">
        <div className="relative flex h-[232px] w-[232px] shrink-0 items-center justify-center rounded-3xl border border-neutral-200 bg-white p-2 dark:border-neutral-700">
          {estado.fase === 'listo' ? (
            <QrSvg texto={estado.url} titulo="Código QR para entrar con el móvil" />
          ) : estado.fase === 'aprobado' ? (
            <div className="flex flex-col items-center gap-3 text-mint-700" role="status">
              <CircleCheck size={48} strokeWidth={1.5} />
              <span className="font-medium">Entrando…</span>
            </div>
          ) : estado.fase === 'cargando' ? (
            <Spinner className="h-8 w-8 text-neutral-400" />
          ) : (
            <div className="flex flex-col items-center gap-4 px-4 text-center">
              <p className="text-sm text-neutral-600" role="status">
                {estado.mensaje}
              </p>
              <Button
                size="sm"
                icon={<RefreshCw size={16} strokeWidth={2} />}
                onClick={() => {
                  renovaciones.current = 0
                  void generar()
                }}
              >
                Generar otro
              </Button>
            </div>
          )}
        </div>

        <div className="w-full min-w-0 flex-1">
          <ol className="space-y-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
            <li className="flex gap-3">
              <span className="cifra flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold dark:bg-neutral-800">1</span>
              Abre la cámara del móvil y apunta al código.
            </li>
            <li className="flex gap-3">
              <span className="cifra flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold dark:bg-neutral-800">2</span>
              Comprueba que el móvil muestra el mismo código de abajo.
            </li>
            <li className="flex gap-3">
              <span className="cifra flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold dark:bg-neutral-800">3</span>
              Pulsa «Aprobar». Este ordenador entrará solo.
            </li>
          </ol>

          <div className="mt-6 rounded-2xl bg-neutral-50 p-4 dark:bg-neutral-900">
            <p className="etiqueta">Código de este ordenador</p>
            <p className="cifra mt-1 font-mono text-3xl font-semibold tracking-[0.35em] text-graphite dark:text-white" aria-live="polite">
              {estado.fase === 'listo' ? estado.codigo : '····'}
            </p>
            {estado.fase === 'listo' && (
              <p className="cifra mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Caduca en {Math.floor(restante / 60)}:{String(restante % 60).padStart(2, '0')}
              </p>
            )}
          </div>
          <p className="mt-4 flex gap-2 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
            <ShieldCheck size={16} strokeWidth={1.75} className="shrink-0 text-mint-700 dark:text-mint-400" aria-hidden="true" />
            Escanea solo códigos que veas en tu propia pantalla. Nunca apruebes un código que te hayan enviado.
          </p>
        </div>
      </div>
    </div>
  )
}
