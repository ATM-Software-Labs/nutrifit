import { PanelActividadHidratacion } from './PanelActividadHidratacion.tsx'

interface Props {
  fecha?: string
  inicial?: number
  onCambio?: (ml: number) => void
  pesoKg?: number
}

export function WidgetAgua({ pesoKg = 85.5 }: Props) {
  return <PanelActividadHidratacion pesoKg={pesoKg} />
}
