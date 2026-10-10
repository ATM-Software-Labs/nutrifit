import { useState } from 'react'
import { ArrowLeft, UploadCloud, Activity, Dumbbell, Percent, AlertCircle, Camera, Loader2, Trash2 } from 'lucide-react'
import { navegar } from '../lib/rutas.ts'
import { Button } from './ui/Button.tsx'
import { useToast } from './ui/Toast.tsx'
import GraficaPeso from './GraficaPeso.tsx'
import type { Usuario } from '../lib/tipos.ts'

export default function PaginaPeso({ usuario }: { usuario: Usuario }) {
  const toast = useToast()
  
  const [fotoLocal, setFotoLocal] = useState<string | null>(null)
  const [bfFoto, setBfFoto] = useState<string | null>(() => localStorage.getItem('nf:peso:bf'))
  const [subiendo, setSubiendo] = useState(false)

  import('react').then(({ useEffect }) => {
    useEffect(() => {
      import('../lib/localDb.ts').then(m => m.idbLeerImagen('nf:peso:foto')).then(val => {
        if (val) setFotoLocal(val)
      })
    }, [])
  })

  // Estimaciones simples basadas en el peso y datos demográficos
  const heightM = usuario.altura_cm ? usuario.altura_cm / 100 : 0
  const imcVal = usuario.peso_kg && heightM ? (usuario.peso_kg / (heightM * heightM)) : 0
  const imc = imcVal ? imcVal.toFixed(1) : '--'
  
  // Fórmula Deurenberg para porcentaje de grasa corporal basado en IMC
  let grasaEstimada = '--'
  if (imcVal && usuario.edad) {
    const isMale = usuario.sexo === 'hombre' ? 1 : 0
    const bf = (1.20 * imcVal) + (0.23 * usuario.edad) - (10.8 * isMale) - 5.4
    if (bf > 5 && bf < 60) {
      grasaEstimada = bf.toFixed(1)
    }
  }

  async function handleSubirFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSubiendo(true)
    try {
      const { compressFoodImage } = await import('../lib/imagen.ts')
      const base64 = await compressFoodImage(file)
      const { api } = await import('../lib/api.ts')
      const { bf } = await api.estimarGrasa(file)
      
      // Guardamos la foto localmente siempre (IndexedDB para no reventar cuota)
      const { idbGuardarImagen } = await import('../lib/localDb.ts')
      await idbGuardarImagen('nf:peso:foto', base64)
      setFotoLocal(base64)

      if (bf) {
        const bfStr = Number(bf).toFixed(1)
        localStorage.setItem('nf:peso:bf', bfStr)
        setBfFoto(bfStr)
        toast({ tipo: 'exito', mensaje: 'Composición corporal estimada por IA.' })
      } else {
        localStorage.removeItem('nf:peso:bf')
        setBfFoto(null)
        toast({ tipo: 'info', mensaje: 'Foto guardada. Se usará la estimación corporal genérica.' })
      }
    } catch (err) {
      toast({ tipo: 'error', mensaje: 'Error al procesar la foto.' })
    } finally {
      setSubiendo(false)
    }
  }

  function eliminarFoto() {
    import('../lib/localDb.ts').then(m => m.idbGuardarImagen('nf:peso:foto', ''))
    localStorage.removeItem('nf:peso:bf')
    setFotoLocal(null)
    setBfFoto(null)
  }

  // Masa Muscular Estimada (Aproximación general: LBM)
  let masaMuscular = '--'
  if (grasaEstimada !== '--' && usuario.peso_kg) {
    const bfPercent = parseFloat(grasaEstimada)
    const leanMass = usuario.peso_kg * (1 - (bfPercent / 100))
    masaMuscular = leanMass.toFixed(1)
  } else if (usuario.peso_kg) {
    // Fallback aproximado si no hay edad
    masaMuscular = (usuario.peso_kg * (usuario.sexo === 'hombre' ? 0.75 : 0.65)).toFixed(1)
  }

  const importarData = () => {
    toast({ tipo: 'info', mensaje: 'La sincronización con Apple Health y Google Fit estará disponible en la próxima actualización.' })
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pt-4 lg:px-8 lg:pt-6 flex flex-col gap-3">
      <header className="flex items-center gap-3 hidden lg:flex">
        <button onClick={() => navegar('/')} className="rounded-full p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition">
          <ArrowLeft size={20} className="text-graphite dark:text-neutral-100" />
        </button>
        <h1 className="text-xl lg:text-2xl font-semibold tracking-tight text-graphite dark:text-neutral-100">
          Control de Peso
        </h1>
      </header>

      <div className="space-y-3">
        <GraficaPeso usuario={usuario} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <section className="tarjeta p-3 md:p-4 shadow-sm border border-neutral-100 dark:border-neutral-800 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <h2 className="flex items-center gap-2 font-semibold text-graphite dark:text-neutral-200 text-[15px]">
                <Activity size={18} className="text-mint-600 dark:text-mint-400" />
                Estimación Corporal
              </h2>
              <label className="cursor-pointer flex items-center gap-1.5 rounded-full bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 px-2 py-1 text-xs font-medium transition text-neutral-600 dark:text-neutral-300">
                {subiendo ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                <span>{fotoLocal ? 'Nueva foto' : 'Foto IA'}</span>
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => void handleSubirFoto(e)} disabled={subiendo} />
              </label>
            </div>
            
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <div className="rounded-xl border border-neutral-100 bg-neutral-50/80 dark:border-neutral-800 dark:bg-neutral-900/50 p-2.5 text-center transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-900">
                <p className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold mb-0.5">IMC</p>
                <p className="text-lg font-bold text-graphite dark:text-neutral-100">{imc}</p>
              </div>
              <div className="relative overflow-hidden rounded-xl border border-neutral-100 bg-neutral-50/80 dark:border-neutral-800 dark:bg-neutral-900/50 p-2.5 text-center transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-900">
                {fotoLocal && <img src={fotoLocal} alt="Progreso" className="absolute inset-0 h-full w-full object-cover opacity-20 blur-[1px] dark:opacity-30" />}
                <div className="relative z-10">
                  <p className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold mb-0.5 flex items-center justify-center gap-1">
                    <Percent size={12} className="text-mint-600"/> Grasa {fotoLocal ? '(IA)' : ''}
                  </p>
                  <p className="text-lg font-bold text-graphite dark:text-neutral-100">
                    {fotoLocal && bfFoto ? bfFoto : grasaEstimada}%
                  </p>
                </div>
                {fotoLocal && (
                  <button type="button" onClick={eliminarFoto} className="absolute top-1 right-1 z-20 p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-full" title="Eliminar foto local">
                    <Trash2 size={10} />
                  </button>
                )}
              </div>
              <div className="rounded-xl border border-neutral-100 bg-neutral-50/80 dark:border-neutral-800 dark:bg-neutral-900/50 p-3 col-span-2 flex items-center justify-between transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-900">
                <div className="text-left">
                  <p className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold mb-0.5 flex items-center gap-1">
                    <Dumbbell size={12} className="text-emerald-500"/> Masa Magra
                  </p>
                  <p className="text-lg font-bold text-graphite dark:text-neutral-100">{masaMuscular} <span className="text-sm text-neutral-400 font-medium">kg</span></p>
                </div>
                <div className="text-right flex flex-col items-end">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <AlertCircle size={12} />
                  </div>
                  <p className="text-[9px] text-neutral-400 mt-0.5">Estimación LBM</p>
                </div>
              </div>
            </div>
          </section>

          <section className="tarjeta p-3 md:p-4 shadow-sm border border-neutral-100 dark:border-neutral-800 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-5 pointer-events-none">
              <UploadCloud size={60} />
            </div>
            <div className="relative z-10 flex flex-row md:flex-col justify-between items-center md:items-start mb-2 md:mb-0">
              <h2 className="flex items-center gap-2 font-semibold text-graphite dark:text-neutral-200 text-[15px] md:text-base">
                <UploadCloud size={18} className="text-blue-500" />
                Importar Datos
              </h2>
              <div className="md:mt-3 md:w-full flex-shrink-0">
                <Button variant="outline" size="sm" icon={<UploadCloud size={14} />} onClick={importarData} className="border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:border-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/20 text-xs py-1.5 h-auto">
                  Conectar
                </Button>
              </div>
            </div>
            <div className="relative z-10 hidden md:block">
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Próximamente podrás sincronizar tu historial de peso desde <strong className="font-medium text-graphite dark:text-neutral-200">Apple Health</strong>, <strong className="font-medium text-graphite dark:text-neutral-200">Google Fit</strong> o importar un archivo CSV.
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
