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
    <main className="mx-auto max-w-2xl px-5 pt-6 lg:px-8 lg:pt-10 flex flex-col gap-6 lg:gap-8 min-h-[calc(100vh-80px)]">
      <header className="flex items-center gap-4 hidden lg:flex">
        <button onClick={() => navegar('/')} className="rounded-full p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition">
          <ArrowLeft size={24} className="text-graphite dark:text-neutral-100" />
        </button>
        <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight text-graphite dark:text-neutral-100">
          Hidratación y Actividad
        </h1>
      </header>

      <div className="space-y-6">
        <PanelActividadHidratacion {...props} />
      </div>
    </main>
  )
}
