/**
 * Enrutado mínimo con History API (sin dependencias). Rutas de la app:
 *   /            Hoy (panel diario)
 *   /historial   Historial semanal/mensual
 *   /vincular#id Aprobar desde el móvil el acceso de un ordenador (QR)
 * /descargar y /privacidad son páginas sueltas que se cargan aparte.
 */
import { useEffect, useState } from 'react'

export type RutaApp = '/' | '/historial' | '/vincular'
const RUTAS: RutaApp[] = ['/', '/historial', '/vincular']

export const rutaActual = () => location.pathname.replace(/\/+$/, '') || '/'

export function rutaApp(r = rutaActual()): RutaApp {
  return (RUTAS as string[]).includes(r) ? (r as RutaApp) : '/'
}

const EVENTO = 'nf:ruta'

export function navegar(ruta: RutaApp, { reemplazar = false } = {}) {
  if (ruta === rutaActual() && !location.hash) return
  history[reemplazar ? 'replaceState' : 'pushState'](null, '', ruta)
  window.dispatchEvent(new Event(EVENTO))
  window.scrollTo({ top: 0 })
}

/** Ruta actual, reactiva a navegar() y a los botones atrás/adelante. */
export function useRuta(): RutaApp {
  const [ruta, setRuta] = useState(rutaApp)
  useEffect(() => {
    const f = () => setRuta(rutaApp())
    window.addEventListener('popstate', f)
    window.addEventListener(EVENTO, f)
    return () => {
      window.removeEventListener('popstate', f)
      window.removeEventListener(EVENTO, f)
    }
  }, [])
  return ruta
}

// Vinculación pendiente: si el móvil escanea el QR sin sesión, guardamos el id
// para retomarlo tras entrar (el QR caduca a los 2 min, así que dura poco).
const CLAVE_VINCULO = 'nf:vincular'
export function guardarVinculoPendiente(id: string) {
  localStorage.setItem(CLAVE_VINCULO, JSON.stringify({ id, t: Date.now() }))
}
export function tomarVinculoPendiente(): string | null {
  const v = localStorage.getItem(CLAVE_VINCULO)
  if (!v) return null
  localStorage.removeItem(CLAVE_VINCULO)
  try {
    const { id, t } = JSON.parse(v) as { id: string; t: number }
    return Date.now() - t < 10 * 60_000 && /^[A-Za-z0-9_-]{43}$/.test(id) ? id : null
  } catch {
    return null
  }
}
