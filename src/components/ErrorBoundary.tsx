/**
 * Barrera de errores de nivel superior: si algo revienta al renderizar, en vez
 * de una pantalla en blanco se ve un aviso con «Recargar». Usa estilos en línea
 * (vía CSSOM, compatibles con la CSP) para verse bien aunque el CSS no cargue.
 * Si el fallo es una descarga de código (chunk de un despliegue anterior),
 * primero intenta recargar una vez de forma automática.
 */
import { Component, type CSSProperties, type ErrorInfo, type ReactNode } from 'react'
import { esErrorDeCarga, recargarLimpio, recuperarUnaVez } from '../lib/recuperacion.ts'

interface Estado {
  error: Error | null
  recargando: boolean
}

const oscuro = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches && !document.documentElement.classList.contains('light')

export class ErrorBoundary extends Component<{ children: ReactNode }, Estado> {
  state: Estado = { error: null, recargando: false }

  static getDerivedStateFromError(error: Error): Partial<Estado> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[NutriFit] error no controlado en la interfaz:', error, info.componentStack)
    if (esErrorDeCarga(error) && recuperarUnaVez()) this.setState({ recargando: true })
  }

  render() {
    const { error, recargando } = this.state
    if (!error) return this.props.children
    const dark = oscuro() || document.documentElement.classList.contains('dark')
    const c = {
      fondo: dark ? '#09090B' : '#FAFAFA',
      tarjeta: dark ? '#18181B' : '#FFFFFF',
      borde: dark ? '#27272A' : '#E5E7EB',
      texto: dark ? '#F4F4F5' : '#111827',
      suave: dark ? '#A1A1AA' : '#6B7280',
    }
    const raiz: CSSProperties = {
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      background: c.fondo, color: c.texto,
      fontFamily: 'Outfit, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    }
    const tarjeta: CSSProperties = {
      width: '100%', maxWidth: 360, padding: '32px 24px', borderRadius: 24, textAlign: 'center',
      background: c.tarjeta, border: `1px solid ${c.borde}`, boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.04)',
    }
    return (
      <main style={raiz} role="alert" aria-live="assertive">
        <div style={tarjeta}>
          <div style={{ width: 48, height: 48, margin: '0 auto', borderRadius: 9999, background: dark ? 'rgb(16 185 129 / 0.15)' : '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ width: 12, height: 12, borderRadius: 9999, background: '#10B981' }} />
          </div>
          <h1 style={{ margin: '20px 0 0', fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em' }}>
            {recargando ? 'Actualizando NutriFit…' : 'Algo no ha ido bien'}
          </h1>
          <p style={{ margin: '8px 0 0', fontSize: 15, lineHeight: 1.5, color: c.suave }}>
            {recargando
              ? 'Hay una versión nueva. Un momento, estamos recargando.'
              : 'Se ha producido un error inesperado. Tus datos están a salvo: recarga la página para seguir.'}
          </p>
          {!recargando && (
            <button
              type="button"
              onClick={recargarLimpio}
              style={{
                marginTop: 24, width: '100%', height: 48, border: 0, borderRadius: 16, cursor: 'pointer',
                background: '#047857', color: '#FFFFFF', fontSize: 15, fontWeight: 500, fontFamily: 'inherit',
              }}
            >
              Recargar
            </button>
          )}
        </div>
      </main>
    )
  }
}
