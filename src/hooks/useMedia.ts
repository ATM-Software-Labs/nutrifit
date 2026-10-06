import { useEffect, useState } from 'react'

/** true si se cumple la media query (p. ej. escritorio: '(min-width: 1024px)'). */
export function useMedia(query: string): boolean {
  const [ok, setOk] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(query).matches)
  useEffect(() => {
    const mq = matchMedia(query)
    const f = () => setOk(mq.matches)
    f()
    mq.addEventListener('change', f)
    return () => mq.removeEventListener('change', f)
  }, [query])
  return ok
}

export const ESCRITORIO = '(min-width: 1024px)'
