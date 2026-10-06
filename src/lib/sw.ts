/**
 * Registro del Service Worker (solo en producción) y flujo de actualización.
 *
 * El SW nuevo se activa solo (skipWaiting + clients.claim) para que nunca se
 * quede sirviendo una versión vieja. Si la página ya estaba controlada por un
 * SW anterior, se emite 'nf:actualizacion' y la UI muestra «Nueva versión
 * disponible» → activarActualizacion() recarga. Si mientras tanto falla algún
 * chunk de la versión anterior, recuperacion.ts recarga de forma automática.
 */
import { esNativa } from './plataforma.ts'

export function registrarServiceWorker() {
  // En el APK la web ya va empaquetada: no hace falta Service Worker.
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD || esNativa) return
  const habiaControlador = !!navigator.serviceWorker.controller
  let avisado = false

  window.addEventListener('load', () => {
    navigator.serviceWorker
      // updateViaCache 'none': las comprobaciones de /sw.js nunca salen de la caché HTTP
      // (el dominio puede alargar su Cache-Control).
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((reg) => {
        // Un SW de una versión antigua (sin skipWaiting automático) puede quedarse esperando.
        reg?.waiting?.postMessage({ tipo: 'SKIP_WAITING' })
        const comprobar = () => void reg?.update().catch(() => {})
        setInterval(comprobar, 60 * 60 * 1000)
        document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && comprobar())
      })
      .catch((e) => console.warn('[sw] registro fallido', e))
  })

  // Primera instalación: no hay nada que avisar. Cambio de versión: aviso (una vez).
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!habiaControlador || avisado) return
    avisado = true
    window.dispatchEvent(new CustomEvent('nf:actualizacion'))
  })
}

/** «Actualizar»: el SW nuevo ya controla la página; basta con recargar. */
export function activarActualizacion() {
  window.location.reload()
}
