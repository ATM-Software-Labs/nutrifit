import { useEffect, useState } from 'react'
import { detectarIdioma, eventoIdioma, guardarIdioma, traducir, type Idioma } from '../lib/i18n.ts'

export function useIdioma() {
  const [idioma, setIdioma] = useState<Idioma>(detectarIdioma)
  useEffect(() => {
    const sincronizar = () => setIdioma(detectarIdioma())
    window.addEventListener(eventoIdioma, sincronizar)
    window.addEventListener('storage', sincronizar)
    return () => {
      window.removeEventListener(eventoIdioma, sincronizar)
      window.removeEventListener('storage', sincronizar)
    }
  }, [])
  return {
    idioma,
    t: (clave: string) => traducir(clave, idioma),
    cambiar: (siguiente: Idioma) => guardarIdioma(siguiente),
  }
}
