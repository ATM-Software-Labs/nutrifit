import { useState, useEffect } from 'react'
import { Button } from './ui/Button.tsx'

export function CookieBanner() {
  const [mostrar, setMostrar] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem('nf:cookies_consent')
    if (!consent) {
      setMostrar(true)
    }
  }, [])

  const aceptar = () => {
    localStorage.setItem('nf:cookies_consent', 'true')
    setMostrar(false)
  }

  const rechazar = () => {
    // Para GDPR, al rechazar solo usamos cookies estrictamente necesarias
    localStorage.setItem('nf:cookies_consent', 'false')
    setMostrar(false)
  }

  if (!mostrar) return null

  return (
    <div className="fixed bottom-0 inset-x-0 z-[100] pb-2 sm:pb-5 px-2 sm:px-5 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-md mx-auto bg-bg dark:bg-bg-dark border border-neutral-200 dark:border-neutral-800 shadow-2xl rounded-2xl p-4 sm:p-5 flex flex-col gap-3">
        <div>
          <h3 className="font-semibold text-graphite dark:text-neutral-100 mb-1">Privacidad y Cookies</h3>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
            Utilizamos cookies esenciales para que la aplicación funcione y opciones analíticas para mejorar tu experiencia. Cumpliendo con la normativa GDPR, tú decides.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 mt-1">
          <Button variant="outline" size="sm" onClick={rechazar} className="text-xs px-3">
            Rechazar
          </Button>
          <Button size="sm" onClick={aceptar} className="text-xs px-4">
            Aceptar
          </Button>
        </div>
      </div>
    </div>
  )
}
