import { useId, type CSSProperties } from 'react'

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unidad: string
  onChange: (v: number) => void
  formato?: (v: number) => string
}

/** Slider minimalista sobre input range nativo (teclado y lectores de pantalla incluidos). */
export function Slider({ label, value, min, max, step = 1, unidad, onChange, formato = (v) => String(v) }: SliderProps) {
  const id = useId()
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
          {label}
        </label>
        <output htmlFor={id} className="cifra text-2xl font-semibold tracking-tight">
          {formato(value)}
          <span className="ml-1 text-sm font-normal text-neutral-500 dark:text-neutral-400">{unidad}</span>
        </output>
      </div>
      <input
        id={id}
        type="range"
        className="slider"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={`${formato(value)} ${unidad}`}
        style={{ '--pct': `${pct}%` } as CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="mt-1 flex justify-between text-2xs text-neutral-500 dark:text-neutral-400">
        <span>{formato(min)}</span>
        <span>{formato(max)}</span>
      </div>
    </div>
  )
}
