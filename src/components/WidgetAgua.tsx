import { TarjetaAguaDinamica } from './TarjetaAguaDinamica.tsx'
import { TarjetaEntrenamientos } from './TarjetaEntrenamientos.tsx'

interface Props {
  fecha?: string
  inicial?: number
  onCambio?: (ml: number) => void
  pesoKg?: number
}

export function WidgetAgua({ pesoKg = 85.5 }: Props) {
  return (
    <div className="space-y-4 lg:space-y-6">
      <TarjetaAguaDinamica pesoKg={pesoKg} />
      <TarjetaEntrenamientos pesoUsuario={pesoKg} />
    </div>
  )
}
