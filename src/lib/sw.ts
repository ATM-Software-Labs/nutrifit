/**
 * Registro del Service Worker (solo en producción) y flujo de actualización:
 * cuando hay una versión nueva esperando, se emite 'nf:actualizacion' y la UI
 * muestra el aviso "Nueva versión disponible" → activarActualizacion().
 */
let actualizando = false

export function registrarServiceWorker() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return
  const avisar = (w: ServiceWorker) => window.dispatchEvent(new CustomEvent<ServiceWorker>('nf:actualizacion', { detail: w }))

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        if (reg.waiting && navigator.serviceWorker.controller) avisar(reg.waiting)
        reg.addEventListener('updatefound', () => {
          const nuevo = reg.installing
          nuevo?.addEventListener('statechange', () => {
            if (nuevo.state === 'installed' && navigator.serviceWorker.controller) avisar(nuevo)
          })
        })
        const comprobar = () => void reg.update().catch(() => {})
        setInterval(comprobar, 60 * 60 * 1000)
        document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && comprobar())
      })
      .catch((e) => console.warn('[sw] registro fallido', e))
  })

  // Recargar solo cuando el usuario ha pedido actualizar (no en la 1.ª instalación).
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (actualizando) window.location.reload()
  })
}

export function activarActualizacion(w: ServiceWorker) {
  actualizando = true
  w.postMessage({ tipo: 'SKIP_WAITING' })
}
