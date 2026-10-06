import { useEffect, useState } from 'react'
import { guardarPreferencia, leerPreferencia, type PreferenciaTema } from '../lib/tema.ts'

export function useTema() {
  const [preferencia, setPreferencia] = useState<PreferenciaTema>(leerPreferencia)
  useEffect(() => {
    const f = (e: Event) => setPreferencia((e as CustomEvent<PreferenciaTema>).detail)
    window.addEventListener('nf:tema', f)
    return () => window.removeEventListener('nf:tema', f)
  }, [])
  return { preferencia, cambiar: guardarPreferencia }
}
