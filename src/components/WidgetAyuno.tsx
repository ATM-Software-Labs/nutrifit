import { useEffect, useState } from 'react'

export function WidgetAyuno() {
  const [ayunoActivo, setAyunoActivo] = useState(false)
  const [tipoAyuno, setTipoAyuno] = useState('16/8')

  useEffect(() => {
    setAyunoActivo(localStorage.getItem('nf:ayunoActivo') === 'true')
    setTipoAyuno(localStorage.getItem('nf:tipoAyuno') || '16/8')
  }, [])

  if (!ayunoActivo) return null

  return (
    <div className="tarjeta flex flex-col gap-3 px-6 py-5 bg-neutral-50 dark:bg-neutral-900/40">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold tracking-tight text-neutral-800 dark:text-neutral-100">
          Ayuno Intermitente
        </h3>
        <span className="text-xs font-bold text-mint-600 dark:text-mint-400 bg-mint-50 dark:bg-mint-400/10 px-2 py-0.5 rounded-full">
          {tipoAyuno}
        </span>
      </div>
      <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-snug">
        Actualmente tienes configurado un protocolo de ayuno {tipoAyuno}. Mantente hidratado durante la ventana de ayuno.
      </p>
    </div>
  )
}
