import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { ToastProvider } from './components/ui/Toast.tsx'
import { iniciarTema } from './lib/tema.ts'
import { registrarServiceWorker } from './lib/sw.ts'
import { comprobarEstilos, vigilarChunks } from './lib/recuperacion.ts'
import './index.css'

window.__nfIniciado = true // para el vigilante de public/boot.js
vigilarChunks()
comprobarEstilos()
iniciarTema()

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
