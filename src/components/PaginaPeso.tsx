import { ArrowLeft, UploadCloud, Activity, Dumbbell, Percent } from 'lucide-react'
import { navegar } from '../lib/rutas.ts'
import { Button } from './ui/Button.tsx'
import { useToast } from './ui/Toast.tsx'
import GraficaPeso from './GraficaPeso.tsx'
import type { Usuario } from '../lib/tipos.ts'
export default function PaginaPeso({ usuario }: { usuario: Usuario }) {
  const toast = useToast()

  // Estimaciones simples basadas en el peso y datos demográficos
  // Fórmulas simplificadas para propósitos ilustrativos
  const imc = usuario.peso_kg && usuario.altura_cm ? (usuario.peso_kg / ((usuario.altura_cm / 100) ** 2)).toFixed(1) : '--'
  const grasaEstimada = usuario.sexo === 'hombre' ? 18.5 : 25.2 // Mock
  const masaMuscular = usuario.peso_kg ? (usuario.peso_kg * (usuario.sexo === 'hombre' ? 0.42 : 0.36)).toFixed(1) : '--'

  const importarData = () => {
    toast({ tipo: 'info', mensaje: 'Funcionalidad de importación (Apple Health / Google Fit / CSV) en desarrollo.' })
  }

  return (
    <main className="mx-auto max-w-3xl px-5 pt-6 lg:px-8 lg:pt-10 flex flex-col gap-6 lg:gap-8">
      <header className="flex items-center gap-4 hidden lg:flex">
        <button onClick={() => navegar('/')} className="rounded-full p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition">
          <ArrowLeft size={24} className="text-graphite dark:text-neutral-100" />
        </button>
        <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight text-graphite dark:text-neutral-100">
          Control de Peso
        </h1>
      </header>

      <div className="space-y-6">
        <GraficaPeso usuario={usuario} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <section className="tarjeta p-5 space-y-4">
            <h2 className="flex items-center gap-2 font-semibold text-graphite dark:text-neutral-200">
              <Activity size={18} className="text-mint" />
              Estimación Corporal
            </h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Cálculos aproximados basados en tu peso, altura ({usuario.altura_cm || '--'} cm) y perfil.
            </p>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="rounded-xl bg-neutral-50 dark:bg-neutral-900/50 p-4 text-center">
                <p className="text-2xs uppercase tracking-wider text-neutral-500 mb-1">IMC</p>
                <p className="text-xl font-semibold text-graphite dark:text-neutral-100">{imc}</p>
              </div>
              <div className="rounded-xl bg-neutral-50 dark:bg-neutral-900/50 p-4 text-center">
                <p className="text-2xs uppercase tracking-wider text-neutral-500 mb-1 flex items-center justify-center gap-1">
                  <Percent size={12}/> Grasa
                </p>
                <p className="text-xl font-semibold text-graphite dark:text-neutral-100">{grasaEstimada}%</p>
              </div>
              <div className="rounded-xl bg-neutral-50 dark:bg-neutral-900/50 p-4 text-center col-span-2 flex items-center justify-between">
                <div className="text-left">
                  <p className="text-2xs uppercase tracking-wider text-neutral-500 mb-1 flex items-center gap-1">
                    <Dumbbell size={12}/> Masa Muscular
                  </p>
                  <p className="text-xl font-semibold text-graphite dark:text-neutral-100">{masaMuscular} kg</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-neutral-400">Teórico</p>
                </div>
              </div>
            </div>
          </section>

          <section className="tarjeta p-5 space-y-4 flex flex-col justify-between">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-graphite dark:text-neutral-200">
                <UploadCloud size={18} className="text-blue-500" />
                Importar Datos
              </h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2">
                Sincroniza tu historial de peso desde otras plataformas o importa un archivo CSV con tus registros anteriores.
              </p>
            </div>
            <Button variant="outline" block icon={<UploadCloud size={16} />} onClick={importarData}>
              Importar registros
            </Button>
          </section>
        </div>
      </div>
    </main>
  )
}
