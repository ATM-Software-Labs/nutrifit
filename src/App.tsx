import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Logo } from './components/Logo.tsx'
import { Button } from './components/ui/Button.tsx'
import { useToast } from './components/ui/Toast.tsx'
import { api, ApiError, onSesionPerdida } from './lib/api.ts'
import type { Usuario } from './lib/tipos.ts'
import { activarActualizacion } from './lib/sw.ts'

// Pantallas en chunks separados. Se precargan en paralelo a /api/auth/yo según
// la pista "nf:sesion" para no añadir una cascada de red.
const cargarLogin = () => import('./components/Login.tsx')
const cargarDashboard = () => import('./components/Dashboard.tsx')
const cargarOnboarding = () => import('./components/Onboarding.tsx')
const Login = lazy(cargarLogin)
const Dashboard = lazy(cargarDashboard)
const Onboarding = lazy(cargarOnboarding)

const PISTA = 'nf:sesion'
if (localStorage.getItem(PISTA)) void cargarDashboard()
else void cargarLogin()

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
  const toast = useToast()

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
        localStorage.setItem(PISTA, '1')
        if (!perfilCompleto) void cargarOnboarding()
        setEstado(perfilCompleto ? { fase: 'app', usuario } : { fase: 'onboarding', usuario })
      })
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 401) {
          localStorage.removeItem(PISTA)
          setEstado({ fase: 'anonimo' })
        } else setEstado({ fase: 'error', mensaje: e instanceof Error ? e.message : 'Error' })
      })
  }, [])

  useEffect(() => {
    comprobar()
    onSesionPerdida(() => {
      localStorage.removeItem(PISTA)
      setEstado({ fase: 'anonimo' })
      toast({ mensaje: 'Tu sesión ha caducado. Vuelve a entrar.', tipo: 'info' })
    })
  }, [comprobar, toast])

  // Aviso de nueva versión del Service Worker.
  useEffect(() => {
    const f = (e: Event) =>
      toast({
        mensaje: 'Nueva versión disponible',
        duracion: 0,
        accion: { etiqueta: 'Actualizar', onClick: () => activarActualizacion((e as CustomEvent<ServiceWorker>).detail) },
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
    localStorage.removeItem(PISTA)
    navigator.serviceWorker?.controller?.postMessage({ tipo: 'LIMPIAR_DATOS' })
    setEstado({ fase: 'anonimo' })
  }, [])

  let pantalla
  switch (estado.fase) {
    case 'cargando':
      pantalla = <Cargando />
      break
    case 'error':
      pantalla = (
        <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
          <Logo size={40} className="text-graphite dark:text-neutral-100" />
          <p className="text-neutral-500">{estado.mensaje}</p>
          <Button onClick={comprobar}>Reintentar</Button>
        </main>
      )
      break
    case 'anonimo':
      pantalla = <Login />
      break
    case 'onboarding':
      pantalla = <Onboarding usuario={estado.usuario} onCompletado={(usuario) => setEstado({ fase: 'app', usuario })} />
      break
    case 'app':
      pantalla = <Dashboard usuario={estado.usuario} onUsuario={(usuario) => setEstado({ fase: 'app', usuario })} onSalir={salir} />
      break
  }

  return <Suspense fallback={<Cargando />}>{pantalla}</Suspense>
}
