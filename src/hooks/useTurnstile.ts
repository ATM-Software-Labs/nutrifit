/**
 * Turnstile (Cloudflare) con render EXPLÍCITO y ejecución bajo demanda.
 *
 *   const { contenedorRef, obtenerToken } = useTurnstile('login')
 *   <div ref={contenedorRef} />            ← solo se ve si hace falta interacción
 *   const token = await obtenerToken()     ← ejecuta el reto y devuelve el token
 *
 * La site key se pide a /api/config (una vez). Cada token es de un solo uso:
 * el widget se resetea antes de cada ejecución.
 *
 * Compatible con widgets en modo INVISIBLE (producción) y Managed: se renderiza
 * con execution:'execute' (no corre hasta la acción del usuario) y el tamaño o
 * visibilidad los decide la configuración del widget en Cloudflare. Con
 * appearance:'interaction-only', un widget Managed solo se muestra si exige interacción.
 */
import { useCallback, useEffect, useRef } from 'react'
import { api } from '../lib/api.ts'

interface OpcionesRender {
  sitekey: string
  action?: string
  execution?: 'render' | 'execute'
  appearance?: 'always' | 'execute' | 'interaction-only'
  theme?: 'auto' | 'light' | 'dark'
  language?: string
  size?: 'normal' | 'flexible' | 'compact'
  callback?: (token: string) => void
  'error-callback'?: (codigo: string) => boolean | void
  'expired-callback'?: () => void
  'timeout-callback'?: () => void
}
interface TurnstileApi {
  render: (el: HTMLElement, o: OpcionesRender) => string
  execute: (id: string) => void
  reset: (id: string) => void
  remove: (id: string) => void
}
declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
let promesaScript: Promise<TurnstileApi> | null = null
let promesaClave: Promise<string> | null = null

function cargarScript(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  promesaScript ??= new Promise<TurnstileApi>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = SCRIPT
    s.async = true
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile no disponible')))
    s.onerror = () => {
      promesaScript = null
      reject(new Error('No se pudo cargar la verificación anti-bots. Revisa tu conexión.'))
    }
    document.head.appendChild(s)
  })
  return promesaScript
}

function siteKey(): Promise<string> {
  promesaClave ??= api.config().then((c) => {
    if (!c.turnstileSiteKey) throw new Error('Falta la configuración de Turnstile.')
    return c.turnstileSiteKey
  })
  promesaClave.catch(() => (promesaClave = null))
  return promesaClave
}

/** Precarga script + clave sin bloquear (p. ej. al montar el formulario). */
export function precargarTurnstile() {
  void cargarScript().catch(() => {})
  void siteKey().catch(() => {})
}

export function useTurnstile(accion: string) {
  const contenedorRef = useRef<HTMLDivElement>(null)
  const widget = useRef<string | null>(null)
  const pendiente = useRef<{ res: (t: string) => void; rej: (e: Error) => void } | null>(null)

  useEffect(() => {
    precargarTurnstile()
    return () => {
      if (widget.current) window.turnstile?.remove(widget.current)
      widget.current = null
    }
  }, [])

  const obtenerToken = useCallback(async (): Promise<string> => {
    const [ts, clave] = await Promise.all([cargarScript(), siteKey()])
    const el = contenedorRef.current
    if (!el) throw new Error('Verificación anti-bots no montada.')

    return new Promise<string>((resolve, reject) => {
      const temporizador = setTimeout(() => fin(new Error('La verificación anti-bots ha tardado demasiado. Inténtalo de nuevo.')), 45_000)
      const fin = (r: string | Error) => {
        clearTimeout(temporizador)
        pendiente.current = null
        if (typeof r === 'string') resolve(r)
        else reject(r)
      }
      pendiente.current = { res: fin, rej: fin }

      if (!widget.current) {
        widget.current = ts.render(el, {
          sitekey: clave,
          action: accion,
          execution: 'execute',
          appearance: 'interaction-only',
          theme: 'auto',
          language: 'es',
          callback: (t) => pendiente.current?.res(t),
          'error-callback': () => {
            pendiente.current?.rej(new Error('La verificación anti-bots ha fallado. Recarga e inténtalo de nuevo.'))
            return true
          },
          'timeout-callback': () => pendiente.current?.rej(new Error('La verificación anti-bots ha caducado.')),
        })
      } else {
        ts.reset(widget.current)
      }
      ts.execute(widget.current)
    })
  }, [accion])

  return { contenedorRef, obtenerToken }
}
