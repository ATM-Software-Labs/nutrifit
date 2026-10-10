/**
 * Botón «Instalar la app» del acceso y de Ajustes.
 * Ahora navega a /descargar en lugar de abrir el diálogo nativo,
 * permitiendo al usuario escanear el QR y bajar el APK.
 */
import type { ReactNode } from 'react'
import { navegar } from '../lib/rutas.ts'
import { instalarPWA } from '../lib/instalacion.ts'

export function ControlInstalar({ className, children }: { className?: string; children: ReactNode }) {
  async function pulsar() {
    try {
      const posible = await instalarPWA()
      if (!posible) {
        navegar('/descargar')
      }
    } catch (err) {
      console.warn('Error al instalar PWA:', err)
      navegar('/descargar')
    }
  }

  return (
    <button type="button" className={className} onClick={pulsar}>
      {children}
    </button>
  )
}
