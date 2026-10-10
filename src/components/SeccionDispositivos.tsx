import { useState, useEffect } from 'react'
import { api } from '../lib/api'

interface Dispositivo {
  id: string
  dispositivo?: string | null
  navegador?: string | null
  ip?: string | null
  ultimo_acceso?: number | null
  es_actual?: boolean
}

export function SeccionDispositivos() {
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([])
  const [cargando, setCargando] = useState(true)

  const cargar = async () => {
    try {
      const data = await api.dispositivos()
      setDispositivos(data.dispositivos || [])
    } catch {
      setDispositivos([])
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const revocar = async (id: string) => {
    try {
      await api.cerrarDispositivo(id)
      if (id === 'ALL_OTHER') {
        setDispositivos((prev) => prev.filter((d) => d.es_actual))
      } else {
        setDispositivos((prev) => prev.filter((d) => d.id !== id))
      }
    } catch {
      /* 404 si la sesión no es de esta cuenta */
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-neutral-200 bg-card p-5 dark:border-neutral-800 dark:bg-card-dark">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-graphite dark:text-neutral-100">Dispositivos y sesiones</h3>
          <p className="mt-1 text-sm text-neutral-500">Sesiones activas en tu cuenta.</p>
        </div>
        <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          {dispositivos.length} activos
        </span>
      </div>
      {cargando ? (
        <div className="text-sm text-neutral-500">Cargando sesiones...</div>
      ) : dispositivos.length === 0 ? (
        <div className="rounded-xl bg-neutral-100 p-4 text-center text-sm text-neutral-500 dark:bg-neutral-900">
          No hay sesiones activas.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {dispositivos.map((d) => (
            <div key={d.id} className={`flex items-center justify-between rounded-xl border p-4 ${d.es_actual ? 'border-emerald-500 bg-emerald-500/5 dark:bg-emerald-500/10' : 'border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900'}`}>
              <div>
                <span className="flex items-center gap-2 text-sm font-semibold text-graphite dark:text-neutral-100">
                  {d.dispositivo || 'Navegador Web'}
                  {d.es_actual && <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] uppercase text-emerald-600 dark:text-emerald-400">Actual</span>}
                </span>
                <div className="mt-1 text-xs text-neutral-500">
                  {d.navegador || 'Web'} {d.ip ? `· IP: ${d.ip}` : ''}
                  {d.ultimo_acceso && ` · ${new Date(d.ultimo_acceso * 1000).toLocaleString()}`}
                </div>
              </div>
              {!d.es_actual && (
                <button onClick={() => revocar(d.id)} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 transition hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-900/20">
                  Cerrar
                </button>
              )}
            </div>
          ))}
          {dispositivos.length > 1 && (
            <button onClick={() => revocar('ALL_OTHER')} className="mt-2 w-full rounded-xl bg-red-50 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20">
              Cerrar en todos los demás dispositivos
            </button>
          )}
        </div>
      )}
    </div>
  )
}
