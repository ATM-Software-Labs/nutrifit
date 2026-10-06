/** Resumen diario de /api/comidas/resumen con caché en memoria por fecha. */
import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '../lib/api.ts'
import type { Resumen } from '../lib/tipos.ts'

const cache = new Map<string, Resumen>()

export function useResumen(fecha: string) {
  const [resumen, setResumen] = useState<Resumen | null>(() => cache.get(fecha) ?? null)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    setResumen(cache.get(fecha) ?? null)
    setError(null)
    const ctrl = new AbortController()
    api
      .resumen(fecha, ctrl.signal)
      .then((r) => {
        cache.set(fecha, r)
        setResumen(r)
      })
      .catch((e: unknown) => {
        if ((e as Error).name === 'AbortError') return
        setError(e instanceof ApiError ? e.message : 'No se pudo cargar el día.')
      })
    return () => ctrl.abort()
  }, [fecha, version])

  /** Actualización optimista (y de la caché). */
  const actualizar = useCallback(
    (fn: (r: Resumen) => Resumen) =>
      setResumen((prev) => {
        if (!prev) return prev
        const n = fn(prev)
        cache.set(n.fecha, n)
        return n
      }),
    [],
  )

  const recargar = useCallback(() => setVersion((v) => v + 1), [])
  return { resumen, error, actualizar, recargar }
}

export const limpiarCacheResumen = () => cache.clear()
