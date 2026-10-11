/**
 * Botón «Instalar la app» del acceso y de Ajustes.
 * Ahora navega a /descargar en lugar de abrir el diálogo nativo,
 * permitiendo al usuario escanear el QR y bajar el APK.
 */
import type { ReactNode } from 'react'
import { navegar } from '../lib/rutas.ts'
import { instalarPWA } from '../lib/instalacion.ts'

export function ControlInstalar({ className, children, mostrarMasInfo = false }: { className?: string; children: ReactNode; mostrarMasInfo?: boolean }) {
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

  if (!mostrarMasInfo) {
    return (
      <button type="button" className={className} onClick={pulsar}>
        {children}
      </button>
    )
  }

  return (
    <div>
      <button type="button" className={className} onClick={pulsar}>
        {children}
      </button>
      <a
        href="/descargar"
        className="mt-1.5 block text-center text-sm font-medium text-neutral-500 transition hover:text-graphite dark:text-neutral-400 dark:hover:text-white"
      >
        Más info →
      </a>
    </div>
  )
}
