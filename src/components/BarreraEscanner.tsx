/**
 * Si el escáner revienta al pintar, se cierra la hoja y el diario sigue
 * con las comidas de esta sesión. No borra la sesión ni el historial.
 */
import { Component, type ReactNode } from 'react'
import { Button } from './ui/Button.tsx'

interface Props {
  onVolver: () => void
  children: ReactNode
}

interface Estado {
  error: Error | null
}

export class BarreraEscanner extends Component<Props, Estado> {
  state: Estado = { error: null }

  static getDerivedStateFromError(error: Error): Estado {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="alert">
        <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-lift dark:bg-neutral-950">
          <h2 className="text-lg font-semibold text-graphite dark:text-white">No hemos podido mostrar el escáner</h2>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">Tu diario y las comidas de esta sesión siguen guardados.</p>
          <Button className="mt-4" block onClick={this.props.onVolver}>
            Volver al diario
          </Button>
        </div>
      </div>
    )
  }
}
