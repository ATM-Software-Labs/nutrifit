type LogoProps = {
  /** Tamaño en px del imagotipo (cuadrado). */
  size?: number
  /** Muestra el wordmark "NutriFit" al lado del imagotipo. */
  withWordmark?: boolean
  className?: string
}

/**
 * Imagotipo NutriFit inline: anillo de macros (3 segmentos) + brote.
 * El segmento grafito usa `currentColor`, así se adapta a modo claro/oscuro.
 */
export function Logo({ size = 48, withWordmark = false, className = '' }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        role="img"
        aria-label="NutriFit"
      >
        <path
          d="M34.04 13.1A15 15 0 0 1 33.72 35.67 M30.2 37.91A15 15 0 0 1 10.88 31.52"
          stroke="#10B981"
        />
        <path d="M9.38 27.62A15 15 0 0 1 13.96 13.1" stroke="currentColor" />
        <path d="M24 28.25V16.25" stroke="#10B981" />
        <path
          d="M24 19.75C24 16.25 21.5 13.75 18 13.75C18 17.25 20.5 19.75 24 19.75Z M24 16.25C24 11.75 27 8.75 31.5 8.75C31.5 13.25 28.5 16.25 24 16.25Z"
          stroke="#10B981"
        />
      </svg>
      {withWordmark && (
        <span className="text-2xl font-medium tracking-tight">
          Nutri<span className="font-semibold text-mint-700 dark:text-mint-400">Fit</span>
        </span>
      )}
    </span>
  )
}
