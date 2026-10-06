import { useEffect, useRef, useState } from 'react'

const reducido = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Interpola un número hacia `objetivo` (ease-out), respetando reduced-motion. */
export function useNumeroAnimado(objetivo: number, ms = 700): number {
  const [valor, setValor] = useState(objetivo)
  const desde = useRef(objetivo)
  useEffect(() => {
    if (reducido()) {
      setValor(objetivo)
      desde.current = objetivo
      return
    }
    const inicio = performance.now()
    const origen = desde.current
    let raf = 0
    const paso = (t: number) => {
      const p = Math.min(1, (t - inicio) / ms)
      const e = 1 - Math.pow(1 - p, 3)
      const v = origen + (objetivo - origen) * e
      setValor(v)
      desde.current = v
      if (p < 1) raf = requestAnimationFrame(paso)
    }
    raf = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(raf)
  }, [objetivo, ms])
  return valor
}
