import { lazy, Suspense, useCallback, useEffect, useState, type ComponentType } from 'react'
import { Logo } from './components/Logo.tsx'
import { Button } from './components/ui/Button.tsx'
import { useToast } from './components/ui/Toast.tsx'
import { api, ApiError, onSesionPerdida } from './lib/api.ts'
import type { Usuario } from './lib/tipos.ts'
import { CookieBanner } from './components/CookieBanner.tsx'
import { activarActualizacion } from './lib/sw.ts'
import { esNativa } from './lib/plataforma.ts'
import { borrarTokenApp, guardarTokenApp } from './lib/tokenApp.ts'
import { EVENTO, esRutaPrivacidad, guardarVinculoPendiente, navegar, rutaActual, tomarVinculoPendiente, useRuta } from './lib/rutas.ts'

// Pantallas en chunks separados. Se precargan en paralelo a /api/auth/yo según
// la pista "nf:sesion" para no añadir una cascada de red.
const cargarLogin = () => import('./components/Login.tsx')
const cargarDashboard = () => import('./components/Dashboard.tsx')
const cargarOnboarding = () => import('./components/Onboarding.tsx')
const Login = lazy(cargarLogin)
const Dashboard = lazy(async () => {
  const m = await cargarDashboard()
  const mod = m as { Dashboard?: ComponentType<any>; default?: ComponentType<any> }
  return { default: mod.Dashboard || mod.default! }
})
const Onboarding = lazy(cargarOnboarding)
// Páginas sueltas (accesibles sin sesión)
const SeccionDescargas = lazy(() => import('./components/SeccionDescargas.tsx'))
const Privacidad = lazy(() => import('./components/Privacidad.tsx'))
const Vincular = lazy(() => import('./components/Vincular.tsx'))

const ruta = rutaActual()
/** La política no pasa por el panel. Se mira el pathname real, no una ruta normalizada a Hoy. */
const entraEnPrivacidad = window.location.pathname === '/privacidad' || esRutaPrivacidad(window.location.pathname)

// /vincular#<id>: el id del QR viaja en el fragmento (no llega a ningún servidor
// ni a los logs). Lo sacamos de la URL nada más arrancar.
let vinculoInicial: string | null = null
if (ruta === '/vincular') {
  const id = location.hash.slice(1)
  if (/^[A-Za-z0-9_-]{43}$/.test(id)) {
    vinculoInicial = id
    guardarVinculoPendiente(id) // por si hay que entrar antes (enlace mágico en otra pestaña)
  }
  history.replaceState(null, '', '/vincular')
} else if (!entraEnPrivacidad && ruta !== '/descargar' && ruta !== '/' && ruta !== '/historial' && ruta !== '/profile' && ruta !== '/ajustes' && ruta !== '/peso') {
  history.replaceState(null, '', '/') // ruta desconocida → Hoy
}

const PISTA = 'nf:sesion'
if (!entraEnPrivacidad && ruta !== '/descargar') {
  if (localStorage.getItem(PISTA)) void (ruta === '/vincular' ? import('./components/Vincular.tsx') : cargarDashboard())
  else void cargarLogin()
}

type Estado =
  | { fase: 'cargando' }
  | { fase: 'error'; mensaje: string }
  | { fase: 'anonimo' }
  | { fase: 'onboarding'; usuario: Usuario }
  | { fase: 'app'; usuario: Usuario }

function Cargando() {
  return (
    <div className="flex min-h-dvh items-center justify-center" aria-busy="true" aria-label="Cargando NutriFit">
      <Logo size={48} className="animate-pulse text-graphite motion-reduce:animate-none dark:text-neutral-100" />
    </div>
  )
}

export default function App() {
  const [estado, setEstado] = useState<Estado>({ fase: 'cargando' })
  const [vinculo, setVinculo] = useState<string | null>(vinculoInicial)
  const rutaApp = useRuta()
  const [enPrivacidad, setEnPrivacidad] = useState(entraEnPrivacidad)
  const toast = useToast()

  useEffect(() => {
    const sync = () => setEnPrivacidad(window.location.pathname === '/privacidad' || esRutaPrivacidad(window.location.pathname))
    window.addEventListener('popstate', sync)
    window.addEventListener(EVENTO, sync)
    return () => {
      window.removeEventListener('popstate', sync)
      window.removeEventListener(EVENTO, sync)
    }
  }, [])

  /** Con sesión: si había una aprobación de QR pendiente, ir a ella. */
  const retomarVinculo = useCallback(() => {
    const id = tomarVinculoPendiente()
    if (id) {
      setVinculo(id)
      navegar('/vincular', { reemplazar: true })
    }
  }, [])

  /** Login completado sin recargar (código del email o QR). */
  const entrar = useCallback(
    (usuario: Usuario, perfilCompleto: boolean) => {
      localStorage.setItem(PISTA, '1')
      if (!perfilCompleto) void cargarOnboarding()
      setEstado(perfilCompleto ? { fase: 'app', usuario } : { fase: 'onboarding', usuario })
      retomarVinculo()
    },
    [retomarVinculo],
  )

  const comprobar = useCallback(() => {
    setEstado({ fase: 'cargando' })
    api
      .yo()
      .then(({ usuario, perfilCompleto }) => {
        if (!usuario) {
          localStorage.removeItem(PISTA)
          setEstado({ fase: 'anonimo' })
          return
        }
        entrar(usuario, perfilCompleto)
      })
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 401) {
          localStorage.removeItem(PISTA)
          setEstado({ fase: 'anonimo' })
        } else setEstado({ fase: 'error', mensaje: e instanceof Error ? e.message : 'Error' })
      })
  }, [entrar])

  // App Android: el magic link abre la app (App Link / esquema propio) con el token.
  const canjear = useCallback(
    async (token: string) => {
      setEstado({ fase: 'cargando' })
      try {
        const r = await api.canjearToken(token)
        await guardarTokenApp(r.token)
        entrar(r.usuario, r.perfilCompleto)
        toast({ tipo: 'exito', mensaje: 'Sesión iniciada' })
      } catch (e) {
        toast({ tipo: 'error', mensaje: e instanceof Error ? e.message : 'No se pudo iniciar sesión.', duracion: 7000 })
        comprobar()
      }
    },
    [comprobar, entrar, toast],
  )

  // APK: el splash nativo no se auto-oculta (launchAutoHide: false).
  // hide() en el primer ciclo de vida y otra vez a los 3000 ms por si la
  // primera llamada llega antes de que el puente Capacitor esté listo.
  useEffect(() => {
    if (!esNativa) return
    const ocultarSplash = () => {
      void import('@capacitor/splash-screen')
        .then(({ SplashScreen }) => SplashScreen.hide())
        .catch(() => {})
    }
    ocultarSplash()
    const watchdog = window.setTimeout(ocultarSplash, 3000)
    return () => window.clearTimeout(watchdog)
  }, [])

  useEffect(() => {
    if (!esNativa) return
    void import('./lib/nativo.ts').then((m) =>
      m.iniciarNativo(
        (t) => void canjear(t),
        (id) => {
          // App Link https://…/vincular#id abierto en la app
          guardarVinculoPendiente(id)
          setVinculo(id)
          navegar('/vincular')
        },
      ),
    )
  }, [canjear])

  useEffect(() => {
    if (rutaApp === '/descargar' || entraEnPrivacidad) return
    comprobar()
    onSesionPerdida(() => {
      localStorage.removeItem(PISTA)
      setEstado({ fase: 'anonimo' })
      toast({ mensaje: 'Tu sesión ha caducado. Vuelve a entrar.', tipo: 'info' })
    })
  }, [comprobar, toast])

  // Aviso de nueva versión del Service Worker.
  useEffect(() => {
    const f = () =>
      toast({
        mensaje: 'Nueva versión disponible',
        duracion: 0,
        accion: { etiqueta: 'Actualizar', onClick: activarActualizacion },
      })
    window.addEventListener('nf:actualizacion', f)
    return () => window.removeEventListener('nf:actualizacion', f)
  }, [toast])

  const salir = useCallback(async () => {
    try {
      await api.salir()
    } catch {
      /* da igual: borramos el estado local */
    }
    if (esNativa) await borrarTokenApp().catch(() => {})
    localStorage.removeItem(PISTA)
    navigator.serviceWorker?.controller?.postMessage({ tipo: 'LIMPIAR_DATOS' })
    setEstado({ fase: 'anonimo' })
  }, [])

  if (window.location.pathname === '/privacidad' || enPrivacidad) {
    return (
      <Suspense fallback={<Cargando />}>
        <Privacidad />
      </Suspense>
    )
  }
  if (rutaApp === '/descargar' && !esNativa) return <Suspense fallback={<Cargando />}><SeccionDescargas /></Suspense>

  let pantalla
  switch (estado.fase) {
    case 'cargando':
      pantalla = <Cargando />
      break
    case 'error':
      pantalla = (
        <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
          <Logo size={40} className="text-graphite dark:text-neutral-100" />
          <h1 className="text-xl font-semibold tracking-tight text-graphite dark:text-neutral-100">No hemos podido abrir NutriFit</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Problemas de conexión. La sesión y los datos de este dispositivo se conservan.</p>
          <Button onClick={comprobar}>Reintentar</Button>
          <Button
            variant="outline"
            onClick={() => {
              window.location.assign('/')
            }}
          >
            Volver al diario
          </Button>
        </main>
      )
      break
    case 'anonimo':
      pantalla = <Login onEntrar={entrar} vinculando={rutaApp === '/vincular'} />
      break
    case 'onboarding':
    case 'app':
      if (rutaApp === '/vincular') {
        pantalla = (
          <Vincular
            id={vinculo}
            onTerminar={() => {
              setVinculo(null)
              navegar('/', { reemplazar: true })
            }}
          />
        )
        break
      }
      if (estado.fase === 'app') {
        const vistaDashboard = rutaApp === '/historial' ? 'historial' : rutaApp === '/profile' ? 'profile' : rutaApp === '/ajustes' ? 'ajustes' : rutaApp === '/peso' ? 'peso' : rutaApp === '/agua' ? 'agua' : 'hoy'
        pantalla = <Dashboard usuario={estado.usuario} vista={vistaDashboard} onUsuario={(usuario: any) => setEstado({ fase: 'app', usuario })} onSalir={salir} />
        break
      }
      pantalla = <Onboarding usuario={estado.usuario} onCompletado={(usuario) => setEstado({ fase: 'app', usuario })} />
      break
  }

  return (
    <Suspense fallback={<Cargando />}>
      {pantalla}
      <CookieBanner />
    </Suspense>
  )
}
