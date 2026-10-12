import { useState } from 'react'
import { fondoBlancoActivo, setFondoBlanco } from '../lib/fondoBlanco.ts'

/** Ajustes > Privacidad: fondo blanco en fotos (activado por defecto). */
export function AjusteFondoBlanco() {
  const [on, setOn] = useState(fondoBlancoActivo)
  const cambiar = () => { setFondoBlanco(!on); setOn(!on) }
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex-1">
        <p className="text-[15px] font-medium">Fondo blanco en fotos</p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">Antes de subir, el móvil deja solo el plato o el envase y pinta el resto de blanco. Tu casa y las personas no salen; la foto original no sale del dispositivo.</p>
      </div>
      <button type="button" role="switch" aria-checked={on} aria-label="Fondo blanco en fotos" onClick={cambiar} className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${on ? 'bg-mint' : 'bg-neutral-300 dark:bg-neutral-700'}`}>
        <span className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  )
}
