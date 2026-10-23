import { useEffect, useState } from 'react'
import { Bell, BellOff, Mail, Moon, Send } from 'lucide-react'
import { Button } from './ui/Button.tsx'
import { useToast } from './ui/Toast.tsx'
import { esNativa } from '../lib/plataforma.ts'
import { activarPush, desactivarPush, guardarRecordatorios, leerRecordatorios, probarPush, pushSoportado, type EstadoRecordatorios, type Franja, type PrefRecordatorios } from '../lib/push.ts'
import { programarRecordatoriosNativos } from '../lib/notificaciones.ts'
import { FranjasRecordatorio } from './FranjasRecordatorio.tsx'

const CIERRE_POR_DEFECTO = '22:30'
const franjaValida = (f: Franja) => f.fin > f.inicio && f.nombre.trim().length > 0

const TIPOS: { k: string; l: string }[] = [
  { k: 'comidas', l: 'Comidas sin registrar' },
  { k: 'agua', l: 'Agua' },
  { k: 'cierre', l: 'Cierra tu día' },
  { k: 'racha', l: 'Racha en peligro' },
  { k: 'objetivo', l: 'Objetivo del día (calorías/proteína)' },
  { k: 'logros', l: 'Logros desbloqueados' },
  { k: 'resumen', l: 'Resumen semanal (lunes)' },
  { k: 'inactividad', l: 'Si llevas días sin registrar' },
  { k: 'bienvenida', l: 'Consejos de bienvenida' },
  { k: 'seguridad', l: 'Seguridad de la cuenta' },
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
  const [probando, setProbando] = useState(false)
  useEffect(() => {
    leerRecordatorios().then((r) => { setE(r); setP({ ...r.preferencias, franjas: r.franjas, zona: r.preferencias.activo ? r.preferencias.zona : Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid' }) }).catch(() => {})
  }, [])
  if (!p || !e) return <div className="tarjeta h-40 animate-pulse" aria-hidden="true" />

  async function guardar(sig: PrefRecordatorios, mensaje = 'Recordatorios guardados') {
    setP(sig)
    if (sig.franjas && !sig.franjas.every(franjaValida)) return // se guarda cuando la franja vuelva a ser válida
    setGuardando(true)
    try {
      const r = await guardarRecordatorios(sig)
      setE(r)
      // Las horas de la app nativa salen de las franjas (las calcula el servidor).
      if (esNativa) await programarRecordatoriosNativos({ ...sig, ...r.preferencias }).catch(() => {})
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

  /** "Probar aviso": si este navegador aún no está suscrito, pide permiso y lo suscribe antes. */
  async function probar() {
    setProbando(true)
    try {
      let estado = e!
      const suscrito = pushSoportado() && Notification.permission === 'granted' && !!(await navigator.serviceWorker.ready.then((r) => r.pushManager.getSubscription()).catch(() => null))
      if (!suscrito || !estado.dispositivosPush) {
        if (!estado.vapidPublica) throw new Error('Las notificaciones push no están configuradas todavía.')
        const r = await activarPush(estado.vapidPublica)
        if (r === 'denegado') throw new Error('Has bloqueado las notificaciones de NutriFit. Actívalas en los ajustes del navegador o del sistema.')
        if (r === 'no-soportado') throw new Error('Este navegador no admite notificaciones. En iPhone, instala la app en la pantalla de inicio (iOS 16.4 o posterior).')
        estado = await leerRecordatorios()
        setE(estado)
      }
      const r = await probarPush()
      toast({ tipo: r.enviados ? 'exito' : 'error', mensaje: r.enviados ? `Aviso enviado a ${r.enviados} ${r.enviados === 1 ? 'dispositivo' : 'dispositivos'}. Debería llegar en unos segundos.` : 'No se pudo entregar el aviso.' })
    } catch (err) {
      toast({ tipo: 'error', mensaje: err instanceof Error ? err.message : 'No se pudo enviar el aviso.' })
    } finally {
      setProbando(false)
    }
  }

  const fila = 'flex items-center justify-between gap-4 p-4'
  return (
    <div id="recordatorios" aria-busy={guardando} className="divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-200 bg-card dark:divide-neutral-800 dark:border-neutral-800 dark:bg-card-dark">
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
          <FranjasRecordatorio
            franjas={p.franjas ?? e.franjas}
            sugerencias={e.sugerencias ?? {}}
            porDefecto={e.franjasPorDefecto ?? []}
            maxDia={p.max_dia}
            otrosAvisos={p.cierre ? 1 : 0}
            onCambio={(franjas, persistir, mensaje) => (persistir ? void guardar({ ...p, franjas }, mensaje) : setP({ ...p, franjas }))}
          />
          {!esNativa && pushSoportado() && e.pushDisponible && (
            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-semibold">Probar aviso</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Te mandamos ahora uno igual que los de las comidas, con los botones «Ya comí» y «Saltar hoy».</p>
              </div>
              <Button variant="outline" size="sm" icon={<Send size={14} />} loading={probando} onClick={() => void probar()}>
                Probar aviso
              </Button>
            </div>
          )}
          <div className={fila}>
            <label className="flex flex-1 items-center gap-3 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-mint-600" checked={p.cierre !== null} onChange={(ev) => void guardar({ ...p, cierre: ev.target.checked ? CIERRE_POR_DEFECTO : null })} />
              Cierra tu día (si llevas menos de 3 comidas)
            </label>
            <input type="time" aria-label="Hora de cierre del día" disabled={p.cierre === null} value={p.cierre ?? CIERRE_POR_DEFECTO} onChange={(ev) => setP({ ...p, cierre: ev.target.value })} onBlur={() => void guardar(p)} className="rounded-lg border border-neutral-200 bg-transparent px-2 py-1 text-sm disabled:opacity-40 dark:border-neutral-700" />
          </div>
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
              {[1, 2, 3, 4, 5, 6, 7, 8, 10].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className={fila}>
            <span className="flex items-center gap-2 text-sm"><Mail size={15} className="text-neutral-400" /> También por correo si no tienes notificaciones</span>
            <Interruptor on={p.email} onClick={() => void guardar({ ...p, email: !p.email })} label="Recordatorios por correo" />
          </div>
        </>
      )}
      {p.canales && (
        <div className="p-4">
          <p className="text-sm font-semibold">Qué te avisamos y por dónde</p>
          <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">Como mucho {p.max_dia} avisos al día y nunca en horas de silencio.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-neutral-500"><th className="py-1 text-left font-medium">Aviso</th><th className="px-2 font-medium">Push</th><th className="px-2 font-medium">Email</th><th className="px-2 font-medium">App</th></tr></thead>
              <tbody>
                {TIPOS.map(({ k, l }) => {
                  const c = p.canales![k] ?? { push: false, email: false, app: false }
                  return (
                    <tr key={k} className="border-t border-neutral-100 dark:border-neutral-800">
                      <td className="py-2 pr-2">{l}</td>
                      {(['push', 'email', 'app'] as const).map((canal) => (
                        <td key={canal} className="px-2 text-center">
                          <input type="checkbox" aria-label={`${l} por ${canal}`} className="h-4 w-4 accent-mint-600" checked={c[canal]} onChange={(ev) => void guardar({ ...p, canales: { ...p.canales!, [k]: { ...c, [canal]: ev.target.checked } } })} />
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div className={fila}>
        <div>
          <p className="text-sm font-semibold">Resumen semanal por correo</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Los lunes a las 9:00: constancia, racha y logros de la semana.</p>
        </div>
        <Interruptor on={p.resumen_semanal} onClick={() => void guardar({ ...p, resumen_semanal: !p.resumen_semanal })} label="Resumen semanal" />
      </div>
    </div>
  )
}
