import { useEffect, useState } from 'react'
import { api } from '../lib/api'

interface Integracion {
  proveedor: string
  estado: string | null
}

/** Strava ya no se conecta. El listado sale del servidor y no incluye tokens. */
export function SeccionIntegraciones() {
  const [integraciones, setIntegraciones] = useState<Integracion[]>([])

  useEffect(() => {
    let vivo = true
    api
      .integraciones()
      .then((r) => {
        if (vivo) setIntegraciones(r.integraciones.filter((i) => i.proveedor.toLowerCase() !== 'strava'))
      })
      .catch(() => {
        if (vivo) setIntegraciones([])
      })
    return () => {
      vivo = false
    }
  }, [])

  return (
    <div className="mt-6 rounded-2xl border border-neutral-200 bg-card p-5 dark:border-neutral-800 dark:bg-card-dark">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-graphite dark:text-neutral-100">Integraciones y Wearables</h3>
        <p className="mt-1 text-sm text-neutral-500">Servicios conectados a tu cuenta.</p>
      </div>
      {integraciones.length === 0 ? (
        <div className="rounded-xl bg-neutral-100 p-4 text-sm text-neutral-500 dark:bg-neutral-900">
          No hay servicios conectados.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {integraciones.map((i) => (
            <div key={i.proveedor} className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="text-sm font-semibold text-graphite dark:text-neutral-100">{i.proveedor}</div>
              <span className="text-xs text-neutral-500 capitalize">{i.estado ?? 'Conectado'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
