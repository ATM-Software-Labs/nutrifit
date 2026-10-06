/**
 * Panel diario: semana, anillo de calorías restantes, barras P/C/G, secciones
 * de comidas (plegables), agua y peso. Altas y bajas optimistas.
 */
import { lazy, Suspense, useCallback, useState } from 'react'
import { Plus, Settings } from 'lucide-react'
import { Logo } from './Logo.tsx'
import { AnilloCalorias } from './AnilloCalorias.tsx'
import { BarraMacro } from './BarrasMacros.tsx'
import { SelectorSemana } from './SelectorSemana.tsx'
import { SeccionComida } from './SeccionComida.tsx'
import { HojaAnadir } from './HojaAnadir.tsx'
import { WidgetAgua } from './WidgetAgua.tsx'
import { BannerInstalarPWA } from './BannerInstalarPWA.tsx'
import { Button } from './ui/Button.tsx'
import { useToast } from './ui/Toast.tsx'
import { useResumen } from '../hooks/useResumen.ts'
import { api } from '../lib/api.ts'
import { conComida, reemplazarComida, sinComida } from '../lib/resumen.ts'
import { fechaLarga, hoyISO, tipoPorHora } from '../lib/fechas.ts'
import { TIPOS_COMIDA, type Comida, type NuevaComida, type ResultadoAnalisis, type TipoComida, type Usuario } from '../lib/tipos.ts'

const ScannerComida = lazy(() => import('./ScannerComida.tsx'))
const ModalRevisionPlato = lazy(() => import('./ModalRevisionPlato.tsx'))
const GraficaPeso = lazy(() => import('./GraficaPeso.tsx'))
const Ajustes = lazy(() => import('./Ajustes.tsx'))

type Hoja =
  | null
  | { tipo: 'anadir'; comida: TipoComida }
  | { tipo: 'scanner'; comida: TipoComida; archivo: File }
  | { tipo: 'revision'; comida: TipoComida; resultado: ResultadoAnalisis | null; imagenUrl: string | null }
  | { tipo: 'ajustes' }

function saludo() {
  const h = new Date().getHours()
  return h < 6 ? 'Buenas noches' : h < 14 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches'
}

function Esqueleto({ alto = 'h-40' }: { alto?: string }) {
  return <div className={`tarjeta ${alto} animate-pulse bg-neutral-100/60 dark:bg-neutral-900/60`} />
}

export default function Dashboard({ usuario, onUsuario, onSalir }: { usuario: Usuario; onUsuario: (u: Usuario) => void; onSalir: () => void }) {
  const [fecha, setFecha] = useState(hoyISO)
  const [hoja, setHoja] = useState<Hoja>(null)
  const { resumen, error, actualizar, recargar } = useResumen(fecha)
  const toast = useToast()
  const cerrar = useCallback(() => setHoja(null), [])

  const metas = resumen?.metas ?? {
    calorias: usuario.meta_calorias ?? 2000,
    proteinas: usuario.meta_proteinas ?? 0,
    carbohidratos: usuario.meta_carbs ?? 0,
    grasas: usuario.meta_grasas ?? 0,
  }
  const totales = resumen?.totales ?? { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 }

  async function guardar(nueva: NuevaComida) {
    setHoja(null)
    const idTemporal = `tmp-${crypto.randomUUID()}`
    const optimista: Comida = { ...nueva, id: idTemporal, imagen_url: null, creado_en: new Date().toISOString(), ingredientes: nueva.ingredientes ?? [], pendiente: true }
    if (nueva.fecha !== fecha) setFecha(nueva.fecha)
    actualizar((r) => conComida(r, optimista))
    try {
      const { comida } = await api.guardarComida(nueva)
      actualizar((r) => reemplazarComida(r, idTemporal, comida))
      toast({ tipo: 'exito', mensaje: `${comida.descripcion} añadido` })
    } catch (e) {
      actualizar((r) => sinComida(r, idTemporal))
      toast({ tipo: 'error', mensaje: e instanceof Error ? e.message : 'No se pudo guardar la comida.' })
    }
  }

  async function borrar(c: Comida) {
    actualizar((r) => sinComida(r, c.id))
    try {
      await api.borrarComida(c.id)
    } catch (e) {
      actualizar((r) => conComida(r, c))
      toast({ tipo: 'error', mensaje: e instanceof Error ? e.message : 'No se pudo eliminar.' })
    }
  }

  const nombre = usuario.nombre?.split(' ')[0]

  return (
    <div className="mx-auto min-h-dvh max-w-md pb-32 lg:max-w-5xl">
      <header className="sticky top-0 z-30 border-b border-transparent bg-bg/80 px-5 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-md dark:bg-bg-dark/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logo size={30} className="text-graphite dark:text-neutral-100" />
            <span className="text-lg font-semibold tracking-tight">
              Nutri<span className="text-mint-700 dark:text-mint-400">Fit</span>
            </span>
          </div>
          <Button variant="ghost" size="icon" aria-label="Ajustes" onClick={() => setHoja({ tipo: 'ajustes' })}>
            <Settings size={20} strokeWidth={1.75} />
          </Button>
        </div>
      </header>

      <main className="px-5">
        <div className="pb-5 pt-3">
          <p className="text-sm text-neutral-500 first-letter:uppercase dark:text-neutral-400">{fechaLarga(fecha)}</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {saludo()}
            {nombre ? `, ${nombre}` : ''}
          </h1>
        </div>

        <SelectorSemana fecha={fecha} onChange={setFecha} />

        {error && (
          <div role="alert" className="mt-4 flex items-center justify-between rounded-2xl border border-neutral-200 p-4 text-sm dark:border-neutral-800">
            <span className="text-neutral-500">{error}</span>
            <Button size="sm" variant="outline" onClick={recargar}>
              Reintentar
            </Button>
          </div>
        )}

        {/* Un único árbol: en móvil va en orden (anillo, comidas, agua, peso); en
            escritorio, dos columnas con las comidas a la derecha. */}
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start lg:gap-x-6">
          <section className="tarjeta px-6 pb-6 pt-7 lg:col-start-1 lg:row-start-1" aria-label="Resumen de calorías y macros">
            <AnilloCalorias consumidas={totales.calorias} meta={metas.calorias} />
            <div className="mt-7 space-y-4">
              <BarraMacro macro="proteinas" valor={totales.proteinas} meta={metas.proteinas} />
              <BarraMacro macro="carbohidratos" valor={totales.carbohidratos} meta={metas.carbohidratos} />
              <BarraMacro macro="grasas" valor={totales.grasas} meta={metas.grasas} />
            </div>
          </section>

          <div className="space-y-3 lg:col-start-2 lg:row-span-3 lg:row-start-1">
            {resumen === null && !error
              ? TIPOS_COMIDA.map((t) => <Esqueleto key={t} alto="h-[68px]" />)
              : TIPOS_COMIDA.map((t) => (
                  <SeccionComida key={t} tipo={t} comidas={resumen?.comidas[t] ?? []} onAnadir={(comida) => setHoja({ tipo: 'anadir', comida })} onBorrar={(c) => void borrar(c)} />
                ))}
          </div>

          <div className="lg:col-start-1 lg:row-start-2">
            <WidgetAgua fecha={fecha} inicial={resumen?.agua_ml ?? 0} onCambio={(ml) => actualizar((r) => ({ ...r, agua_ml: ml }))} />
          </div>
          <div className="lg:col-start-1 lg:row-start-3">
            <Suspense fallback={<Esqueleto alto="h-64" />}>
              <GraficaPeso usuario={usuario} />
            </Suspense>
          </div>
        </div>
      </main>

      {/* Botón flotante: añadir al tipo de comida que toca por la hora */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => setHoja({ tipo: 'anadir', comida: tipoPorHora() })}
          aria-label="Añadir comida"
          className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-graphite text-white shadow-lift transition-transform hover:scale-105 active:scale-95 dark:bg-white dark:text-graphite"
        >
          <Plus size={24} strokeWidth={2} />
        </button>
      </div>

      <HojaAnadir
        abierto={hoja?.tipo === 'anadir'}
        tipo={hoja?.tipo === 'anadir' ? hoja.comida : 'comida'}
        onClose={cerrar}
        onArchivo={(archivo) => hoja?.tipo === 'anadir' && setHoja({ tipo: 'scanner', comida: hoja.comida, archivo })}
        onManual={() => hoja?.tipo === 'anadir' && setHoja({ tipo: 'revision', comida: hoja.comida, resultado: null, imagenUrl: null })}
      />

      <Suspense fallback={null}>
        {hoja?.tipo === 'scanner' && (
          <ScannerComida
            archivo={hoja.archivo}
            onClose={cerrar}
            onResultado={(resultado, imagenUrl) => setHoja({ tipo: 'revision', comida: hoja.comida, resultado, imagenUrl })}
            onManual={(imagenUrl) => setHoja({ tipo: 'revision', comida: hoja.comida, resultado: null, imagenUrl })}
          />
        )}
        {hoja?.tipo === 'revision' && (
          <ModalRevisionPlato resultado={hoja.resultado} imagenUrl={hoja.imagenUrl} tipoInicial={hoja.comida} fecha={fecha} onClose={cerrar} onConfirmar={(c) => void guardar(c)} />
        )}
        {hoja?.tipo === 'ajustes' && <Ajustes usuario={usuario} onClose={cerrar} onUsuario={(u) => { onUsuario(u); recargar() }} onSalir={onSalir} />}
      </Suspense>

      <BannerInstalarPWA />
    </div>
  )
}
