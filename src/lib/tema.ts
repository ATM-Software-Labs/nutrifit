/**
 * Tema claro/oscuro. Por defecto sigue al sistema; el usuario puede forzarlo en
 * Ajustes. Siempre se refleja como clase .dark o .light en <html> (Tailwind
 * darkMode: 'class'). Antes de cargar JS, index.css usa prefers-color-scheme.
 */
export type PreferenciaTema = 'sistema' | 'claro' | 'oscuro'
const CLAVE = 'nf:tema'
const mq = () => window.matchMedia('(prefers-color-scheme: dark)')

export function leerPreferencia(): PreferenciaTema {
  const v = localStorage.getItem(CLAVE)
  return v === 'claro' || v === 'oscuro' ? v : 'sistema'
}

export function aplicarTema(p: PreferenciaTema = leerPreferencia()) {
  const oscuro = p === 'oscuro' || (p === 'sistema' && mq().matches)
  const html = document.documentElement
  html.classList.toggle('dark', oscuro)
  html.classList.toggle('light', !oscuro)
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', oscuro ? '#09090B' : '#FAFAFA'))
}

export function guardarPreferencia(p: PreferenciaTema) {
  if (p === 'sistema') localStorage.removeItem(CLAVE)
  else localStorage.setItem(CLAVE, p)
  aplicarTema(p)
  window.dispatchEvent(new CustomEvent('nf:tema', { detail: p }))
}

/** Arranque: aplica y sigue los cambios del sistema mientras la preferencia sea 'sistema'. */
export function iniciarTema() {
  aplicarTema()
  mq().addEventListener('change', () => {
    if (leerPreferencia() === 'sistema') aplicarTema('sistema')
  })
}
