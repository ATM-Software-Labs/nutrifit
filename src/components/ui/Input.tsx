import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { cx } from './cx.ts'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
  sufijo?: ReactNode
  /** Oculta visualmente la etiqueta (sigue disponible para lectores de pantalla). */
  labelOculta?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, sufijo, labelOculta, className, id, ...rest },
  ref,
) {
  const auto = useId()
  const idInput = id ?? auto
  const idAyuda = `${idInput}-ayuda`
  return (
    <div className={className}>
      {label && (
        <label htmlFor={idInput} className={cx('mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300', labelOculta && 'sr-only')}>
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={ref}
          id={idInput}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? idAyuda : undefined}
          className={cx(
            'h-12 w-full rounded-2xl border bg-card px-4 text-[15px] text-graphite placeholder:text-neutral-400 transition-colors dark:bg-card-dark dark:text-neutral-100 dark:placeholder:text-neutral-500',
            'focus:border-mint focus:outline-none focus:ring-4 focus:ring-mint/15 focus-visible:ring-offset-0',
            error ? 'border-protein' : 'border-neutral-200 dark:border-neutral-800',
            sufijo ? 'pr-12' : '',
          )}
          {...rest}
        />
        {sufijo && <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-neutral-500 dark:text-neutral-400">{sufijo}</span>}
      </div>
      {(error || hint) && (
        <p id={idAyuda} className={cx('mt-1.5 text-xs', error ? 'text-protein' : 'text-neutral-500 dark:text-neutral-400')}>
          {error ?? hint}
        </p>
      )}
    </div>
  )
})
