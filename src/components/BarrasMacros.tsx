import { cx } from './ui/cx.ts'
import { entero } from '../lib/formato.ts'

export const COLOR_MACRO = {
  proteinas: { barra: 'bg-protein', texto: 'text-protein', nombre: 'Proteína' },
  carbohidratos: { barra: 'bg-carbs', texto: 'text-carbs', nombre: 'Carbohidratos' },
  grasas: { barra: 'bg-fats', texto: 'text-fats', nombre: 'Grasas' },
} as const
export type MacroBarra = keyof typeof COLOR_MACRO

/** Barra fina de un macro: "45 / 140 g" + porcentaje. `etiqueta` cambia el nombre visible sin tocar el cálculo. */
export function BarraMacro({ macro, valor, meta, compacta, etiqueta }: { macro: MacroBarra; valor: number; meta: number; compacta?: boolean; etiqueta?: string }) {
  const pct = meta > 0 ? Math.round((valor / meta) * 100) : 0
  const c = COLOR_MACRO[macro]
  const nombre = etiqueta ?? c.nombre
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{nombre}</span>
        <span className="cifra text-sm text-neutral-500 dark:text-neutral-400">
          <span className="font-medium text-graphite dark:text-neutral-100">{entero(valor)}</span> / {entero(meta)} g
          {!compacta && <span className="ml-2 inline-block w-9 text-right text-xs text-neutral-500 dark:text-neutral-400">{pct}%</span>}
        </span>
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800"
        role="progressbar"
        aria-label={nombre}
        aria-valuemin={0}
        aria-valuemax={meta}
        aria-valuenow={Math.round(valor)}
        aria-valuetext={`${entero(valor)} de ${entero(meta)} gramos`}
      >
        <div
          className={cx('h-full rounded-full transition-[width] duration-700 ease-suave', c.barra)}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  )
}
