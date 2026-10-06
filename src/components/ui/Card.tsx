import type { HTMLAttributes } from 'react'
import { cx } from './cx.ts'

export function Card({ className, interactive, ...rest }: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cx(
        'tarjeta',
        interactive && 'transition-[border-color,box-shadow,transform] duration-200 ease-suave hover:border-neutral-300 hover:shadow-lift dark:hover:border-neutral-700',
        className,
      )}
      {...rest}
    />
  )
}
