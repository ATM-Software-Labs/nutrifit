import { useEffect, useState } from 'react'
import { Bell, BellOff, Mail, Moon, Send } from 'lucide-react'
import { Button } from './ui/Button.tsx'
import { useToast } from './ui/Toast.tsx'
import { esNativa } from '../lib/plataforma.ts'
import { activarPush, desactivarPush, guardarRecordatorios, leerRecordatorios, probarPush, pushSoportado, type EstadoRecordatorios, type PrefRecordatorios } from '../lib/push.ts'
import { programarRecordatoriosNativos } from '../lib/notificaciones.ts'

const COMIDAS: { k: 'desayuno' | 'comida' | 'cena' | 'snack' | 'cierre'; l: string; d: string }[] = [
  { k: 'desayuno', l: 'Desayuno', d: '09:00' },
  { k: 'comida', l: 'Comida', d: '14:30' },
  { k: 'cena', l: 'Cena', d: '21:30' },
  { k: 'snack', l: 'Merienda / snack', d: '18:00' },
  { k: 'cierre', l: 'Cierra tu día', d: '22:30' },
]

function Interruptor({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick} className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${on ? 'bg-mint' : 'bg-neutral-300 dark:bg-neutral-700'}`}>
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${on ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  )
}

/** Recordatorios: solo avisan si esa comida aún no está registrada. */
export default function SeccionRecordatorios() {
  const toast = useToast()
  const [e, setE] = useState<EstadoRecordatorios | null>(null)
  const [p, setP] = useState<PrefRecordatorios | null>(null)
  const [guardando, setGuardando] = useState(false)
  useEffect(() => {
    leerRecordatorios().then((r) => { setE(r); setP({ ...r.preferencias, zona: r.preferencias.activo ? r.preferencias.zona : Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid' }) }).catch(() => {})
  }, [])
  if (!p || !e) return <div className="tarjeta h-40 animate-pulse" aria-hidden="true" />

  async function guardar(sig: PrefRecordatorios, mensaje = 'Recordatorios guardados') {
    setP(sig)
    setGuardando(true)
    try {
      const r = await guardarRecordatorios(sig)
      setE(r)
      if (esNativa) await programarRecordatoriosNativos(sig).catch(() => {})
      toast({ tipo: 'exito', mensaje })
    } catch (err) {
      toast({ tipo: 'error', mensaje: err instanceof Error ? err.message : 'No se pudieron guardar.' })
    } finally {
      setGuardando(false)
    }
  }

  async function conmutarActivo() {
    const sig = { ...p!, activo: !p!.activo }
    if (sig.activo && !esNativa && e!.vapidPublica && pushSoportado()) {
      const r = await activarPush(e!.vapidPublica).catch(() => 'no-soportado' as const)
      if (r === 'denegado') toast({ tipo: 'info', mensaje: 'Has bloqueado las notificaciones. Actívalas en los ajustes del navegador o usa el correo.' })
    }
    if (!sig.activo && !esNativa) await desactivarPush()
    await guardar(sig, sig.activo ? 'Recordatorios activados' : 'Recordatorios desactivados')
  }

  const fila = 'flex items-center justify-between gap-4 p-4'
  return (
    <div id="recordatorios" className="divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-200 bg-card dark:divide-neutral-800 dark:border-neutral-800 dark:bg-card-dark">
      <div className={fila}>
        <div className="flex items-start gap-3">
          {p.activo ? <Bell size={18} className="mt-0.5 text-mint-600" /> : <BellOff size={18} className="mt-0.5 text-neutral-400" />}
          <div>
            <p className="text-sm font-semibold">Recordatorios de comidas</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">Solo te avisamos si esa comida aún no está apuntada. {esNativa ? 'En este móvil, como notificación de la app.' : e.dispositivosPush ? `Push activo en ${e.dispositivosPush} ${e.dispositivosPush === 1 ? 'dispositivo' : 'dispositivos'}.` : pushSoportado() ? 'Notificación del navegador (en iPhone, añade la app a la pantalla de inicio).' : 'Este navegador no admite notificaciones: usa el correo.'}</p>
          </div>
        </div>
        <Interruptor on={p.activo} onClick={() => void conmutarActivo()} label="Activar recordatorios" />
      </div>
      {p.activo && (
        <>
          {COMIDAS.map(({ k, l, d }) => (
            <div key={k} className={fila}>
              <label className="flex flex-1 items-center gap-3 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-mint-600" checked={p[k] !== null} onChange={(ev) => void guardar({ ...p, [k]: ev.target.checked ? d : null })} />
                {l}
              </label>
              <input type="time" aria-label={`Hora de ${l}`} disabled={p[k] === null} value={p[k] ?? d} onChange={(ev) => setP({ ...p, [k]: ev.target.value })} onBlur={() => void guardar(p)} className="rounded-lg border border-neutral-200 bg-transparent px-2 py-1 text-sm disabled:opacity-40 dark:border-neutral-700" />
            </div>
          ))}
          <div className={fila}>
            <span className="text-sm">Aviso de agua a las 17:00 si vas por debajo de la mitad</span>
            <Interruptor on={p.agua} onClick={() => void guardar({ ...p, agua: !p.agua })} label="Aviso de agua" />
          </div>
          <div className={fila}>
            <span className="flex items-center gap-2 text-sm"><Moon size={15} className="text-neutral-400" /> Silencio</span>
            <span className="flex items-center gap-1.5 text-sm">
              <input type="time" aria-label="Silencio desde" value={p.silencio_desde} onChange={(ev) => setP({ ...p, silencio_desde: ev.target.value })} onBlur={() => void guardar(p)} className="rounded-lg border border-neutral-200 bg-transparent px-2 py-1 dark:border-neutral-700" />
              –
              <input type="time" aria-label="Silencio hasta" value={p.silencio_hasta} onChange={(ev) => setP({ ...p, silencio_hasta: ev.target.value })} onBlur={() => void guardar(p)} className="rounded-lg border border-neutral-200 bg-transparent px-2 py-1 dark:border-neutral-700" />
            </span>
          </div>
          <div className={fila}>
            <span className="text-sm">Máximo de avisos al día</span>
            <select aria-label="Máximo de avisos al día" value={p.max_dia} onChange={(ev) => void guardar({ ...p, max_dia: Number(ev.target.value) })} className="rounded-lg border border-neutral-200 bg-transparent px-2 py-1 text-sm dark:border-neutral-700">
              {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className={fila}>
            <span className="flex items-center gap-2 text-sm"><Mail size={15} className="text-neutral-400" /> También por correo si no tienes notificaciones</span>
            <Interruptor on={p.email} onClick={() => void guardar({ ...p, email: !p.email })} label="Recordatorios por correo" />
          </div>
        </>
      )}
      <div className={fila}>
        <div>
          <p className="text-sm font-semibold">Resumen semanal por correo</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Los lunes a las 9:00: constancia, racha y logros de la semana.</p>
        </div>
        <Interruptor on={p.resumen_semanal} onClick={() => void guardar({ ...p, resumen_semanal: !p.resumen_semanal })} label="Resumen semanal" />
      </div>
      {p.activo && !esNativa && e.dispositivosPush > 0 && (
        <div className="p-4">
          <Button variant="outline" size="sm" icon={<Send size={14} />} loading={guardando} onClick={() => void probarPush().then((r) => toast({ tipo: r.enviados ? 'exito' : 'error', mensaje: r.enviados ? 'Aviso de prueba enviado' : 'No se pudo entregar el aviso' })).catch((err) => toast({ tipo: 'error', mensaje: err.message }))}>
            Enviar aviso de prueba
          </Button>
        </div>
      )}
    </div>
  )
}
