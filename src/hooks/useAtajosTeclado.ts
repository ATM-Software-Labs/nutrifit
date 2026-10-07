import { useEffect } from 'react'

interface AccionesAtajos {
  alPulsarNuevaComida?: () => void
  alPulsarEscanear?: () => void
  alDiaAnterior?: () => void
  alDiaSiguiente?: () => void
}

export function useAtajosTeclado(acciones: AccionesAtajos) {
  useEffect(() => {
    const manejarKeyDown = (e: KeyboardEvent) => {
      // Ignorar si el usuario está escribiendo en un input o textarea
      const target = e.target as HTMLElement
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        acciones.alPulsarNuevaComida?.()
      } else if (e.key === 'b' || e.key === 'B') {
        e.preventDefault()
        acciones.alPulsarEscanear?.()
      } else if (e.key === 'ArrowLeft') {
        acciones.alDiaAnterior?.()
      } else if (e.key === 'ArrowRight') {
        acciones.alDiaSiguiente?.()
      }
    }

    window.addEventListener('keydown', manejarKeyDown)
    return () => window.removeEventListener('keydown', manejarKeyDown)
  }, [acciones])
}
