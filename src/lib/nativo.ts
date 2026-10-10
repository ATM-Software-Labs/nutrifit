/**
 * Integración nativa (solo dentro del APK; se carga con import() dinámico):
 *  · Magic link → App Link https://nutri…/app-login?token=… o esquema propio
 *    com.trujillomingorance.nutrifit://login?token=… → canje por token Bearer.
 *  · QR del ordenador → App Link https://nutri…/vincular#<id> → pantalla de aprobación.
 *  · Botón "atrás" de Android: cierra hojas/modales antes de salir.
 *  · Barra de estado acorde al tema claro/oscuro.
 */
import { App } from '@capacitor/app'
import { StatusBar, Style } from '@capacitor/status-bar'
import { URL_SITIO } from './config.ts'

export const ESQUEMA_APP = 'com.trujillomingorance.nutrifit'

/** Extrae el token de un enlace de acceso válido para la app (o null). */
export function tokenDeUrl(url: string): string | null {
  try {
    const u = new URL(url)
    const ruta = u.pathname.replace(/\/+$/, '')
    const appLink = u.protocol === 'https:' && u.hostname === new URL(URL_SITIO).hostname && ruta === '/app-login'
    const esquema = u.protocol === `${ESQUEMA_APP}:` && (u.hostname === 'login' || ruta.replace(/^\/+/, '') === 'login')
    if (!appLink && !esquema) return null
    const t = u.searchParams.get('token')
    return t && t.length >= 20 && t.length <= 1024 ? t : null
  } catch {
    return null
  }
}

/** Id de emparejamiento de un enlace https://nutri…/vincular#<id> (o null). */
export function vinculoDeUrl(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:' || u.hostname !== new URL(URL_SITIO).hostname || u.pathname.replace(/\/+$/, '') !== '/vincular') return null
    const id = u.hash.slice(1)
    return /^[A-Za-z0-9_-]{43}$/.test(id) ? id : null
  } catch {
    return null
  }
}

export async function iniciarNativo(onToken: (token: string) => void, onVinculo?: (id: string) => void) {
  const vistos = new Set<string>() // getLaunchUrl y appUrlOpen pueden traer el mismo enlace
  const manejar = (url?: string) => {
    const t = url ? tokenDeUrl(url) : null
    if (t && !vistos.has(t)) {
      vistos.add(t)
      onToken(t)
    }
    const v = url ? vinculoDeUrl(url) : null
    if (v && !vistos.has(v)) {
      vistos.add(v)
      onVinculo?.(v)
    }
  }
  await App.addListener('appUrlOpen', ({ url }) => manejar(url))
  manejar((await App.getLaunchUrl())?.url)

  await App.addListener('backButton', ({ canGoBack }) => {
    if (document.querySelector('[role="dialog"]')) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    } else if (canGoBack && location.pathname !== '/') {
      history.back()
    } else {
      void App.exitApp()
    }
  })

  const barra = () => {
    const oscuro = document.documentElement.classList.contains('dark')
    void StatusBar.setStyle({ style: oscuro ? Style.Dark : Style.Light }).catch(() => {})
    void StatusBar.setBackgroundColor({ color: oscuro ? '#09090B' : '#FFFFFF' }).catch(() => {})
  }
  barra()
  new MutationObserver(barra).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

  // Configurar notificaciones al iniciar la app
  void import('./notificaciones.ts').then(m => m.programarNotificacionesDiarias())
}
