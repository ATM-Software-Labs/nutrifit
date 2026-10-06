/**
 * Recuperación ante fallos de carga de chunks/CSS (despliegue nuevo con una
 * pestaña, SW o caché HTTP de la versión anterior). Delegamos en el vigilante
 * de public/boot.js (window.__nf), que borra las cachés del SW, vuelve a pedir
 * los recursos y recarga UNA sola vez (anti-bucle de 30 s).
 */
declare global {
  interface Window {
    __nfIniciado?: boolean
    __nf?: { recuperar: (urls?: string[]) => boolean; recargar: () => void; mostrarFallo: () => void }
  }
}

const RE_CARGA =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS|ChunkLoadError|Loading (CSS )?chunk .* failed|text\/html.*is not a valid JavaScript MIME type/i

/** ¿Es un error de descarga de código (y no un fallo de la propia app)? */
export function esErrorDeCarga(e: unknown): boolean {
  const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e ?? '')
  return RE_CARGA.test(msg)
}

/** Intenta recargar una vez; true si la página se va a recargar. */
export function recuperarUnaVez(urls?: string[]): boolean {
  if (window.__nf) return window.__nf.recuperar(urls)
  // Sin vigilante (no debería pasar): misma protección anti-bucle, más simple.
  const CLAVE = 'nf:recarga'
  try {
    const ultima = Number(sessionStorage.getItem(CLAVE)) || 0
    if (Date.now() - ultima < 30_000) return false
    sessionStorage.setItem(CLAVE, String(Date.now()))
  } catch {
    return false
  }
  window.location.reload()
  return true
}

/** Botón «Recargar»: limpia cachés del SW y recarga sin protección anti-bucle. */
export function recargarLimpio() {
  if (window.__nf) window.__nf.recargar()
  else window.location.reload()
}

/**
 * Comprueba, cuando ya han terminado de cargar, que las hojas de estilo con hash
 * se aplicaron (una hoja servida como HTML o con 404 se queda sin `sheet`).
 */
export function comprobarEstilos() {
  const revisar = () => {
    const rotas = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href*="/assets/"]'))
      .filter((l) => !l.sheet)
      .map((l) => l.href)
    if (rotas.length) recuperarUnaVez(rotas)
  }
  if (document.readyState === 'complete') revisar()
  else window.addEventListener('load', revisar, { once: true })
}

/** Vite emite 'vite:preloadError' cuando falla un import() diferido o su CSS. */
export function vigilarChunks() {
  window.addEventListener('vite:preloadError', (e) => {
    if (recuperarUnaVez()) e.preventDefault() // no propagar: vamos a recargar
  })
}
