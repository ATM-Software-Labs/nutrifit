/**
 * Ajustes → Plan del día: horario semanal de entreno (se aplica solo), ajuste de
 * metas en días de entreno y de descanso, nombres de las comidas y porción por defecto.
 */
import { useEffect, useState } from 'react'
import { BedDouble, Dumbbell } from 'lucide-react'
import { Button } from './ui/Button.tsx'
import { Input } from './ui/Input.tsx'
import { cx } from './ui/cx.ts'
import { useToast } from './ui/Toast.tsx'
import { api } from '../lib/api.ts'
import { INICIAL_DIA } from '../lib/fechas.ts'
import { guardarPorcionDefecto } from '../lib/porcionDefecto.ts'
import { aplicarNombresComidas, NOMBRE_TIPO_DEFECTO, TIPOS_COMIDA, type MetasDelta, type PlanDia } from '../lib/tipos.ts'

const CERO: MetasDelta = { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 }
const VACIO: PlanDia = { horario_entreno: 0, auto: true, entreno: CERO, descanso: CERO, nombres: {}, porcion_g: null }
const CAMPOS: { k: keyof MetasDelta; etiqueta: string; sufijo: string }[] = [
  { k: 'calorias', etiqueta: 'Calorías', sufijo: 'kcal' },
  { k: 'proteinas', etiqueta: 'Proteína', sufijo: 'g' },
  { k: 'carbohidratos', etiqueta: 'Carbohidratos', sufijo: 'g' },
  { k: 'grasas', etiqueta: 'Grasas', sufijo: 'g' },
]
const DIAS_LARGOS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

function Ajuste({ titulo, icono, valor, onChange }: { titulo: string; icono: React.ReactNode; valor: MetasDelta; onChange: (v: MetasDelta) => void }) {
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-2 text-sm font-medium">{icono} {titulo}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {CAMPOS.map((c) => (
          <Input
            key={c.k}
            type="number"
            inputMode="numeric"
            label={c.etiqueta}
            sufijo={c.sufijo}
            value={valor[c.k] === 0 ? '' : String(valor[c.k])}
            placeholder="±0"
            onChange={(e) => onChange({ ...valor, [c.k]: Math.round(Number(e.target.value) || 0) })}
          />
        ))}
      </div>
    </div>
  )
}

export function SeccionPlanDia() {
  const toast = useToast()
  const [plan, setPlan] = useState<PlanDia>(VACIO)
  const [cargado, setCargado] = useState(false)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    api.planDia().then((r) => setPlan(r.plan)).catch(() => undefined).finally(() => setCargado(true))
  }, [])

  async function guardar() {
    setGuardando(true)
    try {
      const r = await api.guardarPlanDia(plan)
      setPlan(r.plan)
      aplicarNombresComidas(r.plan.nombres)
      guardarPorcionDefecto(r.plan.porcion_g)
      toast({ tipo: 'exito', mensaje: 'Plan del día guardado' })
    } catch (e) {
      toast({ tipo: 'error', mensaje: e instanceof Error ? e.message : 'No se pudo guardar.' })
    } finally {
      setGuardando(false)
    }
  }

  if (!cargado) return <div className="tarjeta h-40 animate-pulse" />

  return (
    <div className="space-y-6" data-testid="plan-dia">
      <div className="space-y-2">
        <p className="text-sm font-medium">Días de entreno</p>
        <div className="flex gap-1.5" role="group" aria-label="Días de entreno">
          {INICIAL_DIA.map((d, i) => {
            const bit = 1 << i
            const on = (plan.horario_entreno & bit) !== 0
            return (
              <button
                key={i}
                type="button"
                aria-pressed={on}
                aria-label={DIAS_LARGOS[i]}
                onClick={() => setPlan({ ...plan, horario_entreno: plan.horario_entreno ^ bit })}
                className={cx(
                  'h-10 w-10 rounded-full text-sm font-semibold transition-colors',
                  on ? 'bg-graphite text-white dark:bg-white dark:text-graphite' : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400',
                )}
              >
                {d}
              </button>
            )
          })}
        </div>
        <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
          <input type="checkbox" checked={plan.auto} onChange={(e) => setPlan({ ...plan, auto: e.target.checked })} className="h-4 w-4 accent-mint" />
          Aplicar automáticamente (los demás días cuentan como descanso)
        </label>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">Desde el diario puedes cambiar cualquier día a mano.</p>
      </div>

      <Ajuste titulo="Día de entreno: sumar o restar a tus metas" icono={<Dumbbell size={16} className="text-mint-600 dark:text-mint-400" />} valor={plan.entreno} onChange={(v) => setPlan({ ...plan, entreno: v })} />
      <Ajuste titulo="Día de descanso: sumar o restar a tus metas" icono={<BedDouble size={16} className="text-neutral-500" />} valor={plan.descanso} onChange={(v) => setPlan({ ...plan, descanso: v })} />

      <div className="space-y-2">
        <p className="text-sm font-medium">Nombres de las comidas</p>
        <div className="grid grid-cols-2 gap-2">
          {TIPOS_COMIDA.map((t) => (
            <Input
              key={t}
              label={NOMBRE_TIPO_DEFECTO[t]}
              labelOculta
              maxLength={24}
              placeholder={NOMBRE_TIPO_DEFECTO[t]}
              value={plan.nombres[t] ?? ''}
              onChange={(e) => setPlan({ ...plan, nombres: { ...plan.nombres, [t]: e.target.value } })}
            />
          ))}
        </div>
      </div>

      <Input
        type="number"
        inputMode="numeric"
        label="Porción por defecto"
        hint="Se usa al buscar un alimento sin ración conocida ni cantidad recordada."
        sufijo="g"
        min={1}
        max={2000}
        placeholder="100"
        value={plan.porcion_g ?? ''}
        onChange={(e) => {
          const n = Math.round(Number(e.target.value))
          setPlan({ ...plan, porcion_g: n >= 1 && n <= 2000 ? n : null })
        }}
      />

      <Button block loading={guardando} onClick={() => void guardar()} data-testid="plan-dia-guardar">
        Guardar plan del día
      </Button>
    </div>
  )
}
