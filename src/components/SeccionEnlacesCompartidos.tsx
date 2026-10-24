/** Ajustes › Privacidad › Enlaces compartidos: lista de /d/<token> con su estado y botón de revocar. */
import { useEffect, useState } from 'react'
import { Copy, ExternalLink, Link2Off } from 'lucide-react'
import { Button } from './ui/Button.tsx'
import { useToast } from './ui/Toast.tsx'
import { api, type EnlaceDia } from '../lib/api.ts'
import { fechaLarga } from '../lib/fechas.ts'

const fmt = (iso: string) => new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
const ESTADO: Record<EnlaceDia['estado'], string> = { activo: 'Activo', caducado: 'Caducado', revocado: 'Revocado' }

export function SeccionEnlacesCompartidos() {
  const toast = useToast()
  const [enlaces, setEnlaces] = useState<EnlaceDia[] | null>(null)
  const [error, setError] = useState(false)
  const [revocando, setRevocando] = useState<string | null>(null)
  useEffect(() => { api.enlacesDia().then((r) => setEnlaces(r.enlaces)).catch(() => setError(true)) }, [])

  async function revocar(e: EnlaceDia) {
    setRevocando(e.token)
    try {
      await api.revocarEnlaceDia(e.token)
      setEnlaces((l) => l?.map((x) => (x.token === e.token ? { ...x, estado: 'revocado' } : x)) ?? null)
      toast({ mensaje: 'Enlace revocado: ya no se puede abrir', tipo: 'exito' })
    } catch { toast({ mensaje: 'No se pudo revocar', tipo: 'error' }) } finally { setRevocando(null) }
  }

  if (error) return <p className="text-sm text-neutral-500">No se pudieron cargar tus enlaces.</p>
  if (!enlaces) return <div className="h-16 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-900" />
  if (!enlaces.length) return <p className="text-sm text-neutral-500 dark:text-neutral-400">No has creado enlaces públicos. Se crean desde «Compartir mi día» y caducan a los 7 días salvo que elijas «Nunca».</p>
  return (
    <ul className="divide-y divide-neutral-100 dark:divide-neutral-800" data-testid="lista-enlaces">
      {enlaces.map((e) => (
        <li key={e.token} className="flex flex-wrap items-center gap-3 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium first-letter:uppercase">{fechaLarga(e.fecha)} <span aria-hidden>{e.emojis}</span></p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              <span className={e.estado === 'activo' ? 'font-medium text-mint-700 dark:text-mint-400' : ''}>{ESTADO[e.estado]}</span>
              {' · '}creado {fmt(e.creado_en)}
              {e.estado === 'activo' && (e.expira_en ? ` · caduca ${fmt(e.expira_en)}` : ' · sin caducidad')}
              {` · ${e.visitas} ${e.visitas === 1 ? 'visita' : 'visitas'}`}
            </p>
          </div>
          {e.estado === 'activo' && (
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" aria-label="Copiar enlace" onClick={() => void navigator.clipboard.writeText(e.url).then(() => toast({ mensaje: 'Enlace copiado', tipo: 'exito' }))}><Copy size={16} /></Button>
              <a href={e.url} target="_blank" rel="noopener" aria-label="Abrir enlace" className="rounded-full p-2 text-neutral-500 hover:text-graphite dark:hover:text-white"><ExternalLink size={16} /></a>
              <Button size="sm" variant="danger" icon={<Link2Off size={15} />} loading={revocando === e.token} onClick={() => void revocar(e)}>Revocar</Button>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
