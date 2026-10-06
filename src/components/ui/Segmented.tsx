import { useId, type ReactNode } from 'react'
import { cx } from './cx.ts'

interface Opcion<T extends string> {
  valor: T
  etiqueta: ReactNode
}

/** Control segmentado (radiogroup accesible con flechas). */
export function Segmented<T extends string>({
  opciones,
  valor,
  onChange,
  label,
  className,
}: {
  opciones: Opcion<T>[]
  valor: T
  onChange: (v: T) => void
  label: string
  className?: string
}) {
  const nombre = useId()
  return (
    <div role="radiogroup" aria-label={label} className={cx('flex rounded-2xl bg-neutral-100 p-1 dark:bg-neutral-900', className)}>
      {opciones.map((o) => {
        const activo = o.valor === valor
        return (
          <label
            key={o.valor}
            className={cx(
              'relative flex h-9 flex-1 cursor-pointer items-center justify-center rounded-xl text-sm font-medium transition-all duration-200 ease-suave has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-mint/60',
              activo
                ? 'bg-card text-graphite shadow-sm dark:bg-neutral-800 dark:text-white'
                : 'text-neutral-500 hover:text-graphite dark:text-neutral-400 dark:hover:text-white',
            )}
          >
            <input type="radio" name={nombre} value={o.valor} checked={activo} onChange={() => onChange(o.valor)} className="sr-only" />
            {o.etiqueta}
          </label>
        )
      })}
    </div>
  )
}

/** Tarjeta seleccionable (radio) con icono, título y descripción. */
export function OpcionTarjeta({
  nombre,
  seleccionada,
  onSelect,
  icono,
  titulo,
  descripcion,
  extra,
  className,
}: {
  nombre: string
  seleccionada: boolean
  onSelect: () => void
  icono?: ReactNode
  titulo: string
  descripcion?: string
  extra?: ReactNode
  className?: string
}) {
  return (
    <label
      className={cx(
        'group flex cursor-pointer items-center gap-4 rounded-2xl border bg-card p-4 transition-all duration-200 ease-suave dark:bg-card-dark',
        'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-mint/60',
        seleccionada
          ? 'border-mint shadow-[0_0_0_3px_rgb(16_185_129_/_0.12)]'
          : 'border-neutral-200 hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700',
        className,
      )}
    >
      <input type="radio" name={nombre} checked={seleccionada} onChange={onSelect} className="sr-only" />
      {icono && (
        <span
          className={cx(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors',
            seleccionada ? 'bg-mint-50 text-mint-600 dark:bg-mint-950 dark:text-mint-400' : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400',
          )}
        >
          {icono}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{titulo}</span>
        {descripcion && <span className="mt-0.5 block text-sm text-neutral-500 dark:text-neutral-400">{descripcion}</span>}
      </span>
      {extra}
      <span
        aria-hidden="true"
        className={cx(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
          seleccionada ? 'border-mint bg-mint' : 'border-neutral-300 dark:border-neutral-700',
        )}
      >
        {seleccionada && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
      </span>
    </label>
  )
}
