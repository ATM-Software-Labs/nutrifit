/**
 * Aviso del análisis de una foto o un texto, dentro de la hoja de NutriFit.
 * No usa alert(). Cada caso tiene su acción.
 */
import { CircleAlert, ImagePlus, KeyRound, RotateCcw, Timer, WifiOff } from 'lucide-react'
import { Button } from './ui/Button.tsx'
import type { FalloAnalisisUi } from '../lib/falloAnalisis.ts'

export function FalloAnalisis({
  fallo,
  cuentaAtras,
  onReintentar,
  onManual,
  onElegirOtra,
}: {
  fallo: FalloAnalisisUi
  cuentaAtras: number
  onReintentar: () => void
  onManual?: () => void
  onElegirOtra?: () => void
}) {
  const Icono =
    fallo.codigo === 'PAYLOAD_TOO_LARGE' ? ImagePlus : fallo.codigo === 'RATE_LIMIT_EXCEEDED' ? Timer : fallo.codigo === 'AUTH_FAILURE' ? KeyRound : fallo.codigo === 'UPSTREAM_TIMEOUT' ? WifiOff : CircleAlert
  const esperando = cuentaAtras > 0
  return (
    <div className="mt-6 space-y-4" role="alert">
      <p className="flex items-start gap-2.5 rounded-2xl bg-neutral-100 p-4 text-sm dark:bg-neutral-900">
        <Icono size={18} className="mt-px shrink-0 text-fats" aria-hidden="true" />
        <span>
          {fallo.titulo && <span className="mb-1 block font-medium text-graphite dark:text-white">{fallo.titulo}</span>}
          {fallo.mensaje}
          {esperando && fallo.codigo === 'RATE_LIMIT_EXCEEDED' && (
            <span className="mt-1 block text-neutral-500 dark:text-neutral-400">Reintentando automáticamente en {cuentaAtras} segundos...</span>
          )}
          {esperando && fallo.codigo !== 'RATE_LIMIT_EXCEEDED' && (
            <span className="mt-1 block text-neutral-500 dark:text-neutral-400">Reintentando en {cuentaAtras} s…</span>
          )}
        </span>
      </p>
      <div className="flex gap-2">
        {fallo.reintentar && (
          <Button variant="outline" block icon={<RotateCcw size={16} />} disabled={esperando} onClick={onReintentar}>
            Reintentar
          </Button>
        )}
        {fallo.elegirOtra && onElegirOtra && (
          <Button block icon={<ImagePlus size={16} />} onClick={onElegirOtra}>
            Elegir otra foto
          </Button>
        )}
        {fallo.manual && onManual && (
          <Button block variant={fallo.elegirOtra || fallo.reintentar ? 'outline' : 'primary'} onClick={onManual}>
            Añadir a mano
          </Button>
        )}
      </div>
    </div>
  )
}
