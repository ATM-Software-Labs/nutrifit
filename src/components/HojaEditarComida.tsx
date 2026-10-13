import { useMemo, useState } from 'react'
import { Copy, Sparkles, Star, Trash2 } from 'lucide-react'
import { Sheet } from './ui/Sheet.tsx'
import { Button } from './ui/Button.tsx'
import { SelectorEmoji } from './TileEmoji.tsx'
import { cx } from './ui/cx.ts'
import { pedirApi, ApiError } from '../lib/api.ts'
import { emojiDe } from '../lib/miniaturaComida.ts'
import { cantidadInicial, diferencias, escalarNutrientes } from '../lib/editarComida.ts'
import { opcionesRapidas } from '../lib/liquidos.ts'
import { NOMBRE_TIPO, type Comida, type TipoComida } from '../lib/tipos.ts'

const TIPOS: TipoComida[] = ['desayuno', 'comida', 'cena', 'snack']
const UNIDADES = [['g', 'g'], ['ml', 'ml'], ['unidad', 'unidades'], ['racion', 'raciones']] as const
const CAMPO = 'w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-[15px] focus:border-mint focus:outline-none dark:border-neutral-800 dark:bg-neutral-900'

type Estado = {
  descripcion: string; emoji: string; tipo_comida: TipoComida; fecha: string; hora: string | null
  cantidad: number | null; unidad: 'g' | 'ml' | 'unidad' | 'racion' | null
  calorias: number; proteinas: number; carbohidratos: number; grasas: number
  fibra: number | null; azucares: number | null; sal: number | null; notas: string | null
}

function desde(c: Comida): Estado {
  const q = cantidadInicial(c)
  return {
    descripcion: c.descripcion, emoji: emojiDe(c), tipo_comida: c.tipo_comida, fecha: c.fecha, hora: c.hora ?? null,
    cantidad: q.cantidad, unidad: q.unidad, calorias: c.calorias, proteinas: c.proteinas, carbohidratos: c.carbohidratos, grasas: c.grasas,
    fibra: c.fibra ?? null, azucares: c.azucares ?? null, sal: c.sal ?? null, notas: c.notas ?? null,
  }
}

const num = (v: string) => (v.trim() === '' ? null : Math.max(0, Number(v.replace(',', '.'))))

export function HojaEditarComida({ comida, onClose, onGuardada, onDuplicar, onFavorito, onBorrar }: {
  comida: Comida
  onClose: () => void
  onGuardada: (c: Comida, antes: Comida) => void
  onDuplicar: (c: Comida) => void
  onFavorito: (c: Comida) => void
  onBorrar: (c: Comida) => void
}) {
  const inicial = useMemo(() => desde(comida), [comida])
  const [e, setE] = useState<Estado>(inicial)
  const [nombres, setNombres] = useState<string[] | null>(null)
  const [sugiriendo, setSugiriendo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState(false)
  const set = <K extends keyof Estado>(k: K, v: Estado[K]) => setE((x) => ({ ...x, [k]: v }))

  const cambiarCantidad = (v: number | null) => {
    setE((x) => (v != null && x.cantidad ? { ...x, ...escalarNutrientes(x, x.cantidad, v), cantidad: v } : { ...x, cantidad: v }))
  }

  const sugerir = async () => {
    setSugiriendo(true); setError(null)
    try {
      const r = await pedirApi<{ nombres: string[] }>('/api/comidas/sugerir-nombres', { method: 'POST', body: { descripcion: e.descripcion, ingredientes: comida.ingredientes?.map((i) => i.nombre).filter(Boolean).slice(0, 30) } })
      setNombres(r.nombres)
    } catch (err) { setError(err instanceof ApiError ? err.message : 'No hemos podido sugerir nombres ahora.') }
    finally { setSugiriendo(false) }
  }

  const guardar = async () => {
    const cambios = diferencias(inicial as unknown as Record<string, unknown>, e as unknown as Record<string, unknown>)
    if (!Object.keys(cambios).length) return onClose()
    if (!e.descripcion.trim()) return setError('El nombre no puede quedar vacío.')
    setGuardando(true); setError(null)
    try {
      const r = await pedirApi<{ comida: Comida }>(`/api/comidas/${comida.id}`, { method: 'PATCH', body: cambios })
      onGuardada(r.comida, comida)
      onClose()
    } catch (err) { setError(err instanceof ApiError ? err.message : 'No se pudo guardar.') }
    finally { setGuardando(false) }
  }

  const n = (k: 'calorias' | 'proteinas' | 'carbohidratos' | 'grasas' | 'fibra' | 'azucares' | 'sal', etiqueta: string, unidad: string) => (
    <label className="block">
      <span className="text-xs text-neutral-500">{etiqueta} <span className="text-neutral-400">({unidad})</span></span>
      <input inputMode="decimal" className={CAMPO} value={e[k] ?? ''} onChange={(ev) => { const v = num(ev.target.value); set(k, (k === 'fibra' || k === 'azucares' || k === 'sal' ? v : v ?? 0) as never) }} />
    </label>
  )

  return (
    <Sheet abierto onClose={onClose} titulo="Editar comida" ancho="md" pie={
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
        <Button className="flex-1 whitespace-nowrap" loading={guardando} onClick={() => void guardar()}>Guardar cambios</Button>
      </div>
    }>
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <SelectorEmoji tam="lg" emoji={e.emoji} onElegir={(v) => set('emoji', v)} />
          <div className="flex-1">
            <label className="block"><span className="text-xs text-neutral-500">Nombre</span>
              <input className={CAMPO} maxLength={200} value={e.descripcion} onChange={(ev) => set('descripcion', ev.target.value)} />
            </label>
            <button type="button" onClick={() => void sugerir()} disabled={sugiriendo} className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-mint-50 px-3 py-1.5 text-xs font-semibold text-mint-700 disabled:opacity-60 dark:bg-mint-950 dark:text-mint-300">
              <Sparkles size={14} /> {sugiriendo ? 'Pensando…' : 'Sugerir nombres'}
            </button>
          </div>
        </div>
        {nombres && (
          <div className="flex flex-wrap gap-2" aria-label="Nombres sugeridos">
            {nombres.map((x) => (
              <button key={x} type="button" onClick={() => set('descripcion', x)} className={cx('rounded-full border px-3 py-1.5 text-sm', x === e.descripcion ? 'border-mint bg-mint-50 dark:bg-mint-950' : 'border-neutral-200 dark:border-neutral-700')}>{x}</button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-4 gap-1 rounded-xl bg-neutral-100 p-1 dark:bg-neutral-900">
          {TIPOS.map((t) => (
            <button key={t} type="button" onClick={() => set('tipo_comida', t)} className={cx('rounded-lg py-2 text-sm', e.tipo_comida === t ? 'bg-white font-semibold shadow-sm dark:bg-neutral-800' : 'text-neutral-500')}>{NOMBRE_TIPO[t]}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="text-xs text-neutral-500">Fecha</span><input type="date" className={CAMPO} value={e.fecha} onChange={(ev) => ev.target.value && set('fecha', ev.target.value)} /></label>
          <label className="block"><span className="text-xs text-neutral-500">Hora</span><input type="time" className={CAMPO} value={e.hora ?? ''} onChange={(ev) => set('hora', ev.target.value || null)} /></label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="text-xs text-neutral-500">Cantidad <span className="text-neutral-400">(recalcula los nutrientes)</span></span><input inputMode="decimal" className={CAMPO} value={e.cantidad ?? ''} onChange={(ev) => cambiarCantidad(num(ev.target.value))} /></label>
          <label className="block"><span className="text-xs text-neutral-500">Unidad</span>
            <select className={CAMPO} value={e.unidad ?? 'g'} onChange={(ev) => set('unidad', ev.target.value as Estado['unidad'])}>{UNIDADES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
          </label>
        </div>
        {(comida.envase || comida.porcion) && (e.unidad === 'g' || e.unidad === 'ml') && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Cantidades rápidas">
            {opcionesRapidas({ unidad: e.unidad, envase: comida.envase ?? null, racion: comida.porcion ?? null }).map((o) => (
              <button key={o.clave} type="button" aria-pressed={e.cantidad === o.cantidad} onClick={() => cambiarCantidad(o.cantidad)}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${e.cantidad === o.cantidad ? 'border-mint-700 bg-mint-700 text-white' : 'border-neutral-200 hover:border-mint dark:border-neutral-700'}`}>
                {o.etiqueta}
              </button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {n('calorias', 'Calorías', 'kcal')}{n('proteinas', 'Proteína', 'g')}{n('carbohidratos', 'Carbohidratos', 'g')}{n('grasas', 'Grasas', 'g')}
        </div>
        <div className="grid grid-cols-3 gap-3">{n('fibra', 'Fibra', 'g')}{n('azucares', 'Azúcares', 'g')}{n('sal', 'Sal', 'g')}</div>
        <label className="block"><span className="text-xs text-neutral-500">Notas</span>
          <textarea className={cx(CAMPO, 'min-h-20')} maxLength={500} value={e.notas ?? ''} onChange={(ev) => set('notas', ev.target.value || null)} placeholder="Opcional" />
        </label>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-2.5 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">{error}</p>}
        <div className="flex flex-wrap gap-2 border-t border-neutral-100 pt-4 dark:border-neutral-800">
          <button type="button" onClick={() => { onFavorito(comida); onClose() }} className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-700"><Star size={16} /> Favorito</button>
          <button type="button" onClick={() => { onDuplicar(comida); onClose() }} className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-700"><Copy size={16} /> Duplicar</button>
          {confirmar ? (
            <span className="ml-auto inline-flex items-center gap-1">
              <button type="button" onClick={() => setConfirmar(false)} className="rounded-xl px-3 py-2 text-sm text-neutral-500">Cancelar</button>
              <button type="button" onClick={() => { onBorrar(comida); onClose() }} className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 dark:bg-red-950/40">Sí, eliminar</button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirmar(true)} className="ml-auto inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-red-600"><Trash2 size={16} /> Eliminar</button>
          )}
        </div>
      </div>
    </Sheet>
  )
}
