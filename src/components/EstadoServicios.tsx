/** Ajustes › Acerca de: estado de los servicios (D1 principal y Supabase secundaria). Discreto: una fila. */
import { useEffect, useState } from 'react'
import { Activity } from 'lucide-react'
import { api } from '../lib/api.ts'

type Salud = Awaited<ReturnType<typeof api.salud>>

const TEXTO: Record<string, { punto: string; texto: string }> = {
  ok: { punto: 'bg-mint-500', texto: 'Todo funciona' },
  caido: { punto: 'bg-amber-500', texto: 'Catálogo ampliado no disponible: precisión reducida en el análisis' },
  pausado: { punto: 'bg-amber-500', texto: 'Catálogo ampliado en pausa: precisión reducida en el análisis' },
  desconocido: { punto: 'bg-neutral-400', texto: 'Estado del catálogo ampliado sin comprobar' },
  sin_config: { punto: 'bg-mint-500', texto: 'Todo funciona' },
}

export function EstadoServicios() {
  const [salud, setSalud] = useState<Salud | null>(null)
  const [fallo, setFallo] = useState(false)
  useEffect(() => {
    let vivo = true
    api.salud().then((s) => vivo && setSalud(s)).catch(() => vivo && setFallo(true))
    return () => { vivo = false }
  }, [])
  const estado = fallo || (salud && !salud.db) ? { punto: 'bg-red-500', texto: 'Sin conexión con el servidor' } : salud ? TEXTO[salud.servicios.supabase.estado] ?? TEXTO.desconocido : null
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 text-[15px]" data-testid="estado-servicios">
      <Activity size={18} className="text-neutral-500 dark:text-neutral-400" />
      <div className="flex-1 min-w-0">
        <span>Estado de servicios</span>
        <span className="block text-xs text-neutral-400 truncate">{estado ? estado.texto : 'Comprobando…'}</span>
      </div>
      <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${estado?.punto ?? 'bg-neutral-300 animate-pulse'}`} />
    </div>
  )
}
