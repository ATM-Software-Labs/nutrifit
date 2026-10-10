/**
 * Panel diario: semana, anillo de calorías restantes, barras P/C/G, secciones
 * de comidas (plegables), agua y peso. Altas y bajas optimistas.
 * Móvil: una columna + botón flotante. Escritorio (≥ lg): barra lateral y
 * panel en 2–3 columnas con «Añadir comida» siempre visible.
 */
import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { ChartColumn, Plus, Settings, User } from 'lucide-react'
import { Logo } from './Logo.tsx'
import { BarreraEscanner } from './BarreraEscanner.tsx'
import { AnilloCalorias } from './AnilloCalorias.tsx'
import { BarraMacro } from './BarrasMacros.tsx'
import { SelectorSemana } from './SelectorSemana.tsx'
import { SeccionComida } from './SeccionComida.tsx'
import { HojaAnadir } from './HojaAnadir.tsx'
import { WidgetAgua } from './WidgetAgua.tsx'
import { WidgetAyuno } from './WidgetAyuno.tsx'
import { BannerInstalarPWA } from './BannerInstalarPWA.tsx'
import { BarraLateral } from './BarraLateral.tsx'
import { AnadirRapido } from './AnadirRapido.tsx'
import { Button } from './ui/Button.tsx'
import { useToast } from './ui/Toast.tsx'
import { useResumen } from '../hooks/useResumen.ts'
import { api } from '../lib/api.ts'
import { conComida, reemplazarComida, sinComida } from '../lib/resumen.ts'
import { fechaLarga, hoyISO, tipoPorHora } from '../lib/fechas.ts'
import { blobDesdeDataUrl } from '../lib/imagen.ts'
import { esFotoReal } from '../lib/miniaturaComida.ts'
import { clicPrivacidad, navegar } from '../lib/rutas.ts'
import { fijarUsuarioSync } from '../lib/ventanaCliente.ts'
import { TIPOS_COMIDA, type Comida, type NuevaComida, type ResultadoAnalisis, type TipoComida, type Usuario } from '../lib/tipos.ts'

const ScannerComida = lazy(() => import('./ScannerComida.tsx'))
const ModalRevisionPlato = lazy(() => import('./ModalRevisionPlato.tsx'))
const Ajustes = lazy(() => import('./Ajustes.tsx'))
const Historial = lazy(() => import('./Historial.tsx'))
const PaginaPerfil = lazy(async () => {
  const m = await import('./PaginaPerfil.tsx')
  return { default: m.PaginaPerfil }
})
const DescribirComida = lazy(() => import('./DescribirComida.tsx'))
const BuscarAlimento = lazy(() => import('./BuscarAlimento.tsx'))
const PaginaPeso = lazy(() => import('./PaginaPeso.tsx'))

type Hoja =
  | null
  | { tipo: 'anadir'; comida: TipoComida }
  | { tipo: 'scanner'; comida: TipoComida; archivo: File }
  | { tipo: 'texto'; comida: TipoComida }
  | { tipo: 'buscar'; comida: TipoComida }
  | { tipo: 'revision'; comida: TipoComida; resultado: ResultadoAnalisis | null; imagenUrl: string | null }
  | { tipo: 'ajustes' }

function saludo() {
  const h = new Date().getHours()
  return h < 6 ? 'Buenas noches' : h < 14 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches'
}

function Esqueleto({ alto = 'h-40' }: { alto?: string }) {
  return <div className={`tarjeta ${alto} animate-pulse bg-neutral-100/60 dark:bg-neutral-900/60`} />
}

/** Lleva a un widget de Hoy (agua, peso) y enfoca su primer control. */
function irA(id: string) {
  requestAnimationFrame(() => {
    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    el.querySelector<HTMLElement>('input, button')?.focus({ preventScroll: true })
  })
}

export default function Dashboard({
  usuario,
  vista = 'hoy',
  onUsuario,
  onSalir,
}: {
  usuario: Usuario
  vista?: 'hoy' | 'historial' | 'profile' | 'ajustes' | 'peso'
  onUsuario: (u: Usuario) => void
  onSalir: () => void
}) {
  const [fecha, setFecha] = useState(hoyISO)
  const [hoja, setHoja] = useState<Hoja>(null)
  const [quemadas, setQuemadas] = useState(0)
  const [sumarQuemadas, setSumarQuemadas] = useState(false)
  const { resumen, error, actualizar, recargar } = useResumen(fecha)
  const toast = useToast()
  const cerrar = useCallback(() => setHoja(null), [])
  const onActividad = useCallback((kcal: number, sumar: boolean) => {
    setQuemadas(kcal)
    setSumarQuemadas(sumar)
  }, [])

  useEffect(() => {
    fijarUsuarioSync(usuario.id)
    return () => fijarUsuarioSync(null)
  }, [usuario.id])

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
    const optimista: Comida = { ...nueva, id: idTemporal, imagen_url: nueva.imagen_url ?? null, creado_en: new Date().toISOString(), ingredientes: nueva.ingredientes ?? [], pendiente: true }
    if (nueva.fecha !== fecha) setFecha(nueva.fecha)
    actualizar((r) => conComida(r, optimista))
    try {
      let imagen = nueva.imagen_url ?? null
      if (imagen?.startsWith('data:')) {
        const subida = await api.subirFotoPlato(blobDesdeDataUrl(imagen))
        imagen = subida.imagen_url
      } else if (imagen && !imagen.startsWith('/api/archivos/') && !imagen.startsWith('https://')) {
        imagen = null
      }
      const { comida } = await api.guardarComida({ ...nueva, imagen_url: imagen })
      actualizar((r) => reemplazarComida(r, idTemporal, comida))
      toast({ tipo: 'exito', mensaje: `${comida.descripcion} añadido` })
    } catch (e) {
      actualizar((r) => sinComida(r, idTemporal))
      toast({ tipo: 'error', mensaje: e instanceof Error ? e.message : 'No se pudo guardar la comida.' })
    }
  }

  function repetir(c: Comida) {
    const imagen = esFotoReal(c.imagen_url) ? c.imagen_url : null
    void guardar({
      tipo_comida: c.tipo_comida,
      descripcion: c.descripcion,
      calorias: c.calorias,
      proteinas: c.proteinas,
      carbohidratos: c.carbohidratos,
      grasas: c.grasas,
      ingredientes: c.ingredientes,
      imagen_url: imagen,
      fecha: hoyISO(),
    })
  }

  async function frecuente(c: Comida) {
    const base: { nombre: string; gramos?: number; calorias?: number; proteinas?: number; carbohidratos?: number; grasas?: number }[] = c.ingredientes.length
      ? c.ingredientes
      : [{ nombre: c.descripcion, calorias: c.calorias, proteinas: c.proteinas, carbohidratos: c.carbohidratos, grasas: c.grasas }]
    try {
      await api.guardarFrecuente({
        tipo_comida: c.tipo_comida,
        nombre: c.descripcion.trim().slice(0, 80),
        items: base.slice(0, 30).map((i) => ({
          nombre: i.nombre.trim().slice(0, 80) || c.descripcion.trim().slice(0, 80),
          ...(typeof i.gramos === 'number' ? { gramos: i.gramos } : {}),
          calorias: i.calorias,
          proteinas: i.proteinas,
          carbohidratos: i.carbohidratos,
          grasas: i.grasas,
        })),
      })
      toast({ tipo: 'exito', mensaje: 'Guardada como comida frecuente' })
    } catch (e) {
      toast({ tipo: 'error', mensaje: e instanceof Error ? e.message : 'No se pudo guardar la comida frecuente.' })
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

  const verHoy = (destino?: string) => {
    if (vista !== 'hoy') navegar('/')
    if (destino) setTimeout(() => irA(destino), vista !== 'hoy' ? 120 : 0)
  }

  const hoyVista = (
    <main className="px-5 lg:px-10 lg:pt-8">
      <div className="lg:mx-auto lg:max-w-[88rem]">
        <div className="lg:flex lg:items-end lg:justify-between lg:gap-8 lg:pb-6">
          <div className="pb-5 pt-3 lg:p-0">
            <p className="text-sm text-neutral-500 first-letter:uppercase dark:text-neutral-400">{fechaLarga(fecha)}</p>
            <h1 className="text-2xl font-semibold tracking-tight">
              {saludo()}
              {nombre ? `, ${nombre}` : ''}
            </h1>
          </div>
          <div className="lg:w-[26rem] lg:shrink-0">
            <SelectorSemana fecha={fecha} onChange={setFecha} />
          </div>
        </div>

        {error && (
          <div role="alert" className="mt-4 flex items-center justify-between rounded-2xl border border-neutral-200 p-4 text-sm dark:border-neutral-800 lg:mt-0 lg:mb-4">
            <span className="text-neutral-500">{error}</span>
            <Button size="sm" variant="outline" onClick={recargar}>
              Reintentar
            </Button>
          </div>
        )}

        {/*  Un único árbol: en móvil va en orden (anillo, comidas, agua, peso); en
            escritorio, 2 columnas (lg) o 3 (xl) con las comidas en el centro. */}
        <div className="mt-5 flex flex-col gap-4 lg:mt-0 lg:grid lg:grid-cols-12 lg:items-start lg:gap-6 xl:gap-8">
          <div className="flex flex-col gap-4 lg:col-span-5 xl:col-span-4 lg:sticky lg:top-8">
            <section className="tarjeta px-6 pb-6 pt-7" aria-label="Resumen de caloras y macros">
              <AnilloCalorias consumidas={totales.calorias} meta={metas.calorias} quemadas={sumarQuemadas ? quemadas : 0} />
              <div className="mt-7 space-y-4">
                <BarraMacro macro="proteinas" valor={totales.proteinas} meta={metas.proteinas} />
                <BarraMacro macro="carbohidratos" valor={totales.carbohidratos} meta={metas.carbohidratos} />
                <BarraMacro macro="grasas" valor={totales.grasas} meta={metas.grasas} />
              </div>
            </section>

            <div className="hidden lg:block">
              <AnadirRapido
                onTexto={(comida) => setHoja({ tipo: 'texto', comida })}
                onBuscar={(comida) => setHoja({ tipo: 'buscar', comida })}
                onArchivo={(comida, archivo) => setHoja({ tipo: 'scanner', comida, archivo })}
                onManual={(comida) => setHoja({ tipo: 'revision', comida, resultado: null, imagenUrl: null })}
              />
            </div>

            <div className="space-y-4 lg:space-y-6 xl:hidden">
              <WidgetAyuno />
              <WidgetAgua fecha={fecha} inicial={resumen?.agua_ml ?? 0} pesoKg={usuario.peso_kg} onActividad={onActividad} onCambio={(ml) => actualizar((r) => ({ ...r, agua_ml: ml }))} />
            </div>
          </div>

          <div className="space-y-3 lg:col-span-7 xl:col-span-5">
            {resumen === null && !error
              ? TIPOS_COMIDA.map((t) => <Esqueleto key={t} alto="h-[68px]" />)
              : TIPOS_COMIDA.map((t) => (
                  <SeccionComida key={t} tipo={t} comidas={resumen?.comidas[t] ?? []} onAnadir={(comida) => setHoja({ tipo: 'anadir', comida })} onBorrar={(c) => void borrar(c)} onRepetir={repetir} onFrecuente={(c) => void frecuente(c)} />
                ))}
          </div>

          <div className="hidden xl:flex xl:col-span-3 flex-col gap-6 lg:sticky lg:top-8">
            <WidgetAyuno />
            <WidgetAgua fecha={fecha} inicial={resumen?.agua_ml ?? 0} pesoKg={usuario.peso_kg} onActividad={onActividad} onCambio={(ml) => actualizar((r) => ({ ...r, agua_ml: ml }))} />
          </div>
        </div>
      </div>
    </main>
  )

  return (
    <div className="min-h-dvh lg:flex">
      <BarraLateral
        usuario={usuario}
        vista={vista}
        onHoy={() => verHoy()}
        onHistorial={() => navegar('/historial')}
        onAnadir={() => setHoja({ tipo: 'anadir', comida: tipoPorHora() })}
        onPeso={() => navegar('/peso')}
          onAgua={() => verHoy('agua')}
        onAjustes={() => navegar('/ajustes')}
        onPerfil={() => navegar('/profile')}
        onSalir={onSalir}
      />
      <div className="mx-auto min-h-dvh w-full max-w-md pb-32 lg:mx-0 lg:min-w-0 lg:max-w-none lg:flex-1 lg:pb-12">
      <header className="sticky top-0 z-30 border-b border-transparent bg-bg/80 px-5 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-md dark:bg-bg-dark/80 lg:hidden">
        {vista === 'hoy' ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Logo size={30} className="text-graphite dark:text-neutral-100" />
              <span className="text-lg font-semibold tracking-tight">
                Nutri<span className="text-mint-700 dark:text-mint-400">Fit</span>
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" aria-label="Historial" onClick={() => navegar('/historial')}>
                <ChartColumn size={20} strokeWidth={1.75} />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Mi perfil" onClick={() => navegar('/profile')}>
                <User size={20} strokeWidth={1.75} />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Ajustes" onClick={() => navegar('/ajustes')}>
                <Settings size={20} strokeWidth={1.75} />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => navegar('/')} className="rounded-full p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition -ml-2">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-graphite dark:text-neutral-100"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <span className="text-lg font-semibold tracking-tight text-graphite dark:text-neutral-100">
              {vista === 'ajustes' ? 'Ajustes' : vista === 'profile' ? 'Mi Perfil' : vista === 'peso' ? 'Control de Peso' : 'Historial'}
            </span>
          </div>
        )}
      </header>

      {vista === 'hoy' ? (
        hoyVista
      ) : vista === 'profile' ? (
        <Suspense fallback={<div className="p-10"><Esqueleto alto="h-64" /></div>}>
          <PaginaPerfil usuario={usuario} onUsuario={onUsuario} />
        </Suspense>
      ) : vista === 'ajustes' ? (
        <Suspense fallback={<div className="p-10"><Esqueleto alto="h-64" /></div>}>
          <Ajustes usuario={usuario} onClose={() => navegar('/')} onUsuario={(u) => { onUsuario(u); recargar() }} onSalir={onSalir} enPagina={true} />
        </Suspense>
      ) : vista === 'peso' ? (
        <Suspense fallback={<div className="p-10"><Esqueleto alto="h-64" /></div>}>
          <PaginaPeso usuario={usuario} />
        </Suspense>
      ) : (
        <Suspense fallback={<div className="p-10"><Esqueleto alto="h-64" /></div>}>
          <Historial
            usuario={usuario}
            onVerDia={(f) => {
              setFecha(f)
              navegar('/')
            }}
          />
        </Suspense>
      )}
      <footer className="px-5 pb-2 pt-8 text-center text-xs text-neutral-500 dark:text-neutral-400">
        <a href="/privacidad" onClick={clicPrivacidad} className="font-medium underline-offset-2 hover:text-graphite hover:underline dark:hover:text-white">
          Política de Privacidad
        </a>
      </footer>
      </div>

      {/* Botón flotante: añadir al tipo de comida que toca por la hora */}
      {vista !== 'profile' && <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center pb-[max(1.25rem,env(safe-area-inset-bottom))] lg:hidden">
        <button
          type="button"
          onClick={() => setHoja({ tipo: 'anadir', comida: tipoPorHora() })}
          aria-label="Añadir comida"
          className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-graphite text-white shadow-lift transition-transform hover:scale-105 active:scale-95 dark:bg-white dark:text-graphite"
        >
          <Plus size={24} strokeWidth={2} />
        </button>
      </div>}

      <HojaAnadir
        abierto={hoja?.tipo === 'anadir'}
        tipo={hoja?.tipo === 'anadir' ? hoja.comida : 'comida'}
        onClose={cerrar}
        onArchivo={(archivo) => hoja?.tipo === 'anadir' && setHoja({ tipo: 'scanner', comida: hoja.comida, archivo })}
        onManual={() => hoja?.tipo === 'anadir' && setHoja({ tipo: 'revision', comida: hoja.comida, resultado: null, imagenUrl: null })}
        onTexto={() => hoja?.tipo === 'anadir' && setHoja({ tipo: 'texto', comida: hoja.comida })}
        onBuscar={() => hoja?.tipo === 'anadir' && setHoja({ tipo: 'buscar', comida: hoja.comida })}
      />

      <Suspense fallback={null}>
        {hoja?.tipo === 'scanner' && (
          <BarreraEscanner onVolver={cerrar}>
            <ScannerComida
              archivo={hoja.archivo}
              onClose={cerrar}
              onResultado={(resultado, imagenUrl) => setHoja({ tipo: 'revision', comida: hoja.comida, resultado, imagenUrl })}
              onManual={(imagenUrl) => setHoja({ tipo: 'revision', comida: hoja.comida, resultado: null, imagenUrl })}
              onElegirOtra={() => setHoja({ tipo: 'anadir', comida: hoja.comida })}
            />
          </BarreraEscanner>
        )}
        {hoja?.tipo === 'texto' && (
          <DescribirComida
            onClose={cerrar}
            onResultado={(resultado) => setHoja({ tipo: 'revision', comida: hoja.comida, resultado, imagenUrl: null })}
            onManual={() => setHoja({ tipo: 'revision', comida: hoja.comida, resultado: null, imagenUrl: null })}
          />
        )}
        {hoja?.tipo === 'buscar' && <BuscarAlimento onClose={cerrar} onResultado={(resultado) => setHoja({ tipo: 'revision', comida: hoja.comida, resultado, imagenUrl: null })} />}
        {hoja?.tipo === 'revision' && (
          <ModalRevisionPlato resultado={hoja.resultado} imagenUrl={hoja.imagenUrl} tipoInicial={hoja.comida} fecha={fecha} onClose={cerrar} onConfirmar={(c) => void guardar(c)} />
        )}
      </Suspense>

      <BannerInstalarPWA />
    </div>
  )
}
