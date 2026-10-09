/**
 * Botón «Instalar la app» del acceso y de Ajustes.
 * Ahora navega a /descargar en lugar de abrir el diálogo nativo,
 * permitiendo al usuario escanear el QR y bajar el APK.
 */
import type { ReactNode } from 'react'

export function ControlInstalar({ className, children }: { className?: string; children: ReactNode }) {
  function pulsar() {
    window.location.assign('/descargar')
  }

  return (
    <button type="button" className={className} onClick={pulsar}>
      {children}
    </button>
  )
}
