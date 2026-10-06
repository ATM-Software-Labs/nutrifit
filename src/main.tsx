import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { ToastProvider } from './components/ui/Toast.tsx'
import { iniciarTema } from './lib/tema.ts'
import { registrarServiceWorker } from './lib/sw.ts'
import './index.css'

iniciarTema()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
)

registrarServiceWorker()
