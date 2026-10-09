import { PanelActividadHidratacion } from './PanelActividadHidratacion.tsx'

interface Props {
  fecha: string
  inicial: number
  onCambio?: (ml: number) => void
  pesoKg?: number | null
  onActividad?: (kcal: number, sumarAlDia: boolean) => void
}

export function WidgetAgua(props: Props) {
  return <PanelActividadHidratacion {...props} />
}
