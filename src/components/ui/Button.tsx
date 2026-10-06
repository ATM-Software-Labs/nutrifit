import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cx } from './cx.ts'
import { Spinner } from './Spinner.tsx'

type Variante = 'primary' | 'ghost' | 'outline' | 'danger'
type Tamano = 'sm' | 'md' | 'lg' | 'icon'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variante
  size?: Tamano
  loading?: boolean
  icon?: ReactNode
  block?: boolean
}

const VARIANTES: Record<Variante, string> = {
  primary: 'bg-mint-700 text-white shadow-sm hover:bg-mint-800 active:bg-mint-900 disabled:bg-mint-700/50',
  ghost:
    'bg-transparent text-neutral-600 hover:bg-neutral-100 hover:text-graphite dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white',
  outline:
    'border border-neutral-200 bg-card text-graphite hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-card-dark dark:text-neutral-100 dark:hover:border-neutral-700 dark:hover:bg-neutral-900',
  danger: 'bg-protein text-white hover:bg-red-600',
}
const TAMANOS: Record<Tamano, string> = {
  sm: 'h-9 px-3.5 text-sm gap-1.5 rounded-xl',
  md: 'h-11 px-5 text-[15px] gap-2 rounded-2xl',
  lg: 'h-14 px-6 text-base gap-2 rounded-2xl',
  icon: 'h-10 w-10 rounded-full',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, icon, block, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex select-none items-center justify-center font-medium transition-[background-color,border-color,color,transform,opacity] duration-150 ease-suave active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100',
        VARIANTES[variant],
        TAMANOS[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  )
})
