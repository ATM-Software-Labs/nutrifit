import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { ToastProvider } from './components/ui/Toast.tsx'
import { iniciarTema } from './lib/tema.ts'
import { iniciarIdioma } from './lib/i18n.ts'
import { iniciarSyncAgua } from './lib/syncAgua.ts'
import { iniciarSyncPeso } from './lib/syncPeso.ts'
import { programarNotificacionesDiarias } from './lib/notificaciones.ts'
import { registrarServiceWorker } from './lib/sw.ts'
import { comprobarEstilos, vigilarChunks } from './lib/recuperacion.ts'
import { capturarPromptInstalar } from './lib/instalacion.ts'
import './index.css'

window.__nfIniciado = true // para el vigilante de public/boot.js
vigilarChunks()
comprobarEstilos()
iniciarTema()
iniciarIdioma()
iniciarSyncAgua()
iniciarSyncPeso()
capturarPromptInstalar()
programarNotificacionesDiarias()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>,
)

registrarServiceWorker()
