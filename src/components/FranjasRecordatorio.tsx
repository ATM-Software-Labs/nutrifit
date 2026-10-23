import { useState } from 'react'
import { Lightbulb, Plus, RotateCcw, Trash2 } from 'lucide-react'
import type { Franja, Sugerencia } from '../lib/push.ts'

const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const DIAS_LARGO = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
const TIPOS: { v: Franja['tipo']; l: string }[] = [
  { v: 'desayuno', l: 'Desayuno' },
  { v: 'comida', l: 'Comida' },
  { v: 'cena', l: 'Cena' },
  { v: 'snack', l: 'Snack' },
]
const AVISOS = [null, 15, 30, 45, 60, 90, 120] as const
const MAX = 10

const aMin = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5))
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
export const horaAviso = (f: Franja) => hhmm(f.aviso_min === null ? aMin(f.fin) : Math.min(aMin(f.inicio) + f.aviso_min, aMin(f.fin)))

const campo = 'rounded-lg border border-neutral-200 bg-transparent px-2 py-1 text-sm disabled:opacity-40 dark:border-neutral-700'

function Interruptor({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick} className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${on ? 'bg-mint' : 'bg-neutral-300 dark:bg-neutral-700'}`}>
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${on ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  )
}

/**
 * Franjas por comida: "si a esta hora no he apuntado la comida, avísame".
 * onCambio(lista, guardar): guardar=false solo actualiza la pantalla (se guarda al salir del campo).
 */
export function FranjasRecordatorio({ franjas, sugerencias, porDefecto, maxDia, otrosAvisos = 0, onCambio }: {
  franjas: Franja[]
  sugerencias: Record<string, Sugerencia>
  porDefecto: Franja[]
  maxDia: number
  /** Otros avisos diarios activos (p. ej. "Cierra tu día") que comparten el máximo. */
  otrosAvisos?: number
  onCambio: (fs: Franja[], guardar: boolean, mensaje?: string) => void
}) {
  const [abierta, setAbierta] = useState<string | null>(null)
  const set = (id: string, cambio: Partial<Franja>, guardar = true, mensaje?: string) =>
    onCambio(franjas.map((f) => (f.id === id ? { ...f, ...cambio } : f)), guardar, mensaje)
  const guardarActual = () => onCambio(franjas, true)
  const activas = franjas.filter((f) => f.activo).length

  function anadir() {
    const id = `p_${Math.random().toString(36).slice(2, 8)}`
    onCambio([...franjas, { id, nombre: 'Otra comida', tipo: 'snack', inicio: '16:00', fin: '17:00', aviso_min: null, dias: 127, activo: true, orden: franjas.length }], true, 'Comida añadida')
    setAbierta(id)
  }

  return (
    <div className="p-4">
      <p className="text-sm font-semibold">Tus horarios de comida</p>
      <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
        Si al acabar la franja no has apuntado esa comida, te llega un aviso (uno por comida y día). Puedes contestarlo desde la notificación o el reloj.
      </p>
      <ul className="space-y-2">
        {franjas.map((f) => {
          const sug = sugerencias[f.id]
          const sugDistinta = sug && (sug.inicio !== f.inicio || sug.fin !== f.fin)
          const propia = f.id.startsWith('p_')
          const detalle = abierta === f.id
          const invalida = aMin(f.fin) <= aMin(f.inicio)
          return (
            <li key={f.id} className={`rounded-xl border p-3 ${f.activo ? 'border-mint-500/40 bg-mint-50/40 dark:border-mint-500/30 dark:bg-mint-500/5' : 'border-neutral-200 dark:border-neutral-800'}`}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <Interruptor on={f.activo} onClick={() => set(f.id, { activo: !f.activo }, true, f.activo ? `${f.nombre}: sin aviso` : `${f.nombre}: aviso activado`)} label={`Aviso de ${f.nombre}`} />
                {propia ? (
                  <input aria-label="Nombre de la comida" maxLength={30} value={f.nombre} onChange={(ev) => set(f.id, { nombre: ev.target.value }, false)} onBlur={() => f.nombre.trim() && guardarActual()} className={`${campo} w-32 font-medium`} />
                ) : (
                  <span className={`min-w-[6.5rem] text-sm font-medium ${f.activo ? '' : 'text-neutral-500'}`}>{f.nombre}</span>
                )}
                <span className="ml-auto flex items-center gap-1.5">
                  <input type="time" aria-label={`${f.nombre}: desde`} value={f.inicio} disabled={!f.activo} onChange={(ev) => ev.target.value && set(f.id, { inicio: ev.target.value }, false)} onBlur={guardarActual} className={campo} />
                  <span className="text-neutral-400">–</span>
                  <input type="time" aria-label={`${f.nombre}: hasta`} value={f.fin} disabled={!f.activo} onChange={(ev) => ev.target.value && set(f.id, { fin: ev.target.value }, false)} onBlur={guardarActual} className={`${campo} ${invalida ? 'border-red-400' : ''}`} />
                </span>
              </div>
              {f.activo && (
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-neutral-500 dark:text-neutral-400">
                  <span>
                    Aviso a las <strong className="text-neutral-700 dark:text-neutral-200">{horaAviso(f)}</strong>
                    {f.dias !== 127 && <> · {DIAS.filter((_, i) => (f.dias >> i) & 1).join(' ')}</>}
                  </span>
                  <button type="button" onClick={() => setAbierta(detalle ? null : f.id)} className="font-medium text-mint-600 hover:underline dark:text-mint-400">
                    {detalle ? 'Cerrar' : 'Días y aviso'}
                  </button>
                  {invalida && <span className="text-red-500">El fin debe ser posterior al inicio.</span>}
                </div>
              )}
              {f.activo && sugDistinta && (
                <div className="mt-2 flex items-center gap-2 rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-800 dark:bg-amber-400/10 dark:text-amber-200">
                  <Lightbulb size={13} className="shrink-0" />
                  <span className="flex-1">{sug.texto} <span className="opacity-70">({sug.dias} días)</span></span>
                  <button type="button" onClick={() => set(f.id, { inicio: sug.inicio, fin: sug.fin }, true, `${f.nombre}: ${sug.inicio}–${sug.fin}`)} className="rounded-md bg-amber-200/70 px-2 py-0.5 font-semibold hover:bg-amber-200 dark:bg-amber-400/20">Usar</button>
                </div>
              )}
              {f.activo && detalle && (
                <div className="mt-3 space-y-3 border-t border-neutral-200 pt-3 dark:border-neutral-800">
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Días de ${f.nombre}`}>
                    {DIAS.map((d, i) => {
                      const on = ((f.dias >> i) & 1) === 1
                      return (
                        <button key={d} type="button" aria-pressed={on} aria-label={DIAS_LARGO[i]} onClick={() => { const dias = f.dias ^ (1 << i); if (dias) set(f.id, { dias }) }} className={`h-8 w-8 rounded-full text-xs font-semibold transition ${on ? 'bg-mint text-white' : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800'}`}>{d}</button>
                      )
                    })}
                  </div>
                  <label className="flex flex-wrap items-center gap-2 text-sm">
                    Avisar
                    <select value={f.aviso_min ?? ''} onChange={(ev) => set(f.id, { aviso_min: ev.target.value === '' ? null : Number(ev.target.value) })} className={campo}>
                      {AVISOS.map((a) => <option key={a ?? 'fin'} value={a ?? ''}>{a === null ? `al final (${f.fin})` : `${a} min tras el inicio`}</option>)}
                    </select>
                  </label>
                  {propia && (
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <label className="flex items-center gap-2">
                        Cuenta como
                        <select value={f.tipo} onChange={(ev) => set(f.id, { tipo: ev.target.value as Franja['tipo'] })} className={campo}>
                          {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
                        </select>
                      </label>
                      <button type="button" onClick={() => onCambio(franjas.filter((x) => x.id !== f.id), true, 'Comida eliminada')} className="ml-auto flex items-center gap-1 text-xs font-medium text-red-600 hover:underline">
                        <Trash2 size={13} /> Quitar
                      </button>
                    </div>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
        {franjas.length < MAX && (
          <button type="button" onClick={anadir} className="flex items-center gap-1 font-medium text-mint-600 hover:underline dark:text-mint-400"><Plus size={14} /> Añadir otra comida</button>
        )}
        <button type="button" onClick={() => onCambio(porDefecto.map((f) => ({ ...f })), true, 'Horarios restablecidos')} className="flex items-center gap-1 text-neutral-500 hover:underline"><RotateCcw size={13} /> Horarios por defecto</button>
      </div>
      {activas + otrosAvisos > maxDia && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Tienes {activas} comidas con aviso y un máximo de {maxDia} avisos al día: sube el máximo abajo si quieres recibirlos todos.</p>
      )}
    </div>
  )
}
