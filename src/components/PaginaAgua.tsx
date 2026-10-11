import { ArrowLeft } from 'lucide-react'
import { navegar } from '../lib/rutas.ts'
import { PanelActividadHidratacion } from './PanelActividadHidratacion.tsx'

interface Props {
  fecha: string
  inicial: number
  pesoKg?: number | null
  onActividad?: (kcal: number, sumarAlDia: boolean) => void
  onCambio?: (ml: number) => void
}

export default function PaginaAgua(props: Props) {
  return (
    <main className="mx-auto max-w-2xl px-4 pt-2 lg:px-8 lg:pt-2 flex flex-col gap-2.5 min-h-[calc(100dvh-80px)]">
      <header className="flex items-center gap-3 hidden lg:flex mb-1">
        <button onClick={() => navegar('/')} className="rounded-full p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition">
          <ArrowLeft size={20} className="text-graphite dark:text-neutral-100" />
        </button>
        <h1 className="text-xl lg:text-2xl font-semibold tracking-tight text-graphite dark:text-neutral-100">
          Hidratación y Actividad
        </h1>
      </header>

      <div className="space-y-3">
        <PanelActividadHidratacion {...props} />
      </div>
    </main>
  )
}
