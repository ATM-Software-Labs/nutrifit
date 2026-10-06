/** Escritorio: tarjeta «Añadir comida» siempre visible, con zona para soltar fotos. */
import { useState, type ChangeEvent, type ReactNode } from 'react'
import { ImageUp, PenLine, Search, Sparkles } from 'lucide-react'
import { Segmented } from './ui/Segmented.tsx'
import { cx } from './ui/cx.ts'
import { useToast } from './ui/Toast.tsx'
import { useSoltarImagen } from '../hooks/useSoltarImagen.ts'
import { tipoPorHora } from '../lib/fechas.ts'
import { NOMBRE_TIPO, TIPOS_COMIDA, type TipoComida } from '../lib/tipos.ts'

const BOTON =
  'flex items-center gap-3 rounded-xl border border-neutral-200 px-3.5 py-3 text-left text-sm font-medium transition hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:border-neutral-700 dark:hover:bg-neutral-900'

function Icono({ children }: { children: ReactNode }) {
  return <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-mint-50 text-mint-700 dark:bg-mint-950 dark:text-mint-400">{children}</span>
}

export function AnadirRapido({
  onTexto,
  onBuscar,
  onArchivo,
  onManual,
}: {
  onTexto: (t: TipoComida) => void
  onBuscar: (t: TipoComida) => void
  onArchivo: (t: TipoComida, f: File) => void
  onManual: (t: TipoComida) => void
}) {
  const [tipo, setTipo] = useState<TipoComida>(tipoPorHora)
  const toast = useToast()
  const { encima, props } = useSoltarImagen(
    (f) => onArchivo(tipo, f),
    (mensaje) => toast({ tipo: 'error', mensaje }),
  )
  const elegir = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (f) onArchivo(tipo, f)
  }
  const i = { size: 16, strokeWidth: 1.75 }
  return (
    <section className={cx('tarjeta relative p-5 transition-colors', encima && 'border-mint ring-4 ring-mint/15')} aria-labelledby="titulo-anadir" {...props}>
      <h2 id="titulo-anadir" className="font-semibold">
        Añadir comida
      </h2>
      <Segmented
        className="mt-4"
        label="Tipo de comida"
        valor={tipo}
        onChange={setTipo}
        opciones={TIPOS_COMIDA.map((t) => ({ valor: t, etiqueta: NOMBRE_TIPO[t] }))}
      />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" className={BOTON} onClick={() => onTexto(tipo)}>
          <Icono>
            <Sparkles {...i} />
          </Icono>
          Describir
        </button>
        <button type="button" className={BOTON} onClick={() => onBuscar(tipo)}>
          <Icono>
            <Search {...i} />
          </Icono>
          Buscar alimento
        </button>
        <label className={cx(BOTON, 'cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-mint/60')}>
          <Icono>
            <ImageUp {...i} />
          </Icono>
          Subir foto
          <input type="file" accept="image/*" className="sr-only" onChange={elegir} />
        </label>
        <button type="button" className={BOTON} onClick={() => onManual(tipo)}>
          <Icono>
            <PenLine {...i} />
          </Icono>
          Manual
        </button>
      </div>
      <p className="mt-3 text-center text-xs text-neutral-500 dark:text-neutral-400">o arrastra aquí la foto de tu plato</p>
      {encima && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-mint-50/90 text-sm font-medium text-mint-800 dark:bg-mint-950/90 dark:text-mint-200">
          Suelta la foto para analizarla
        </div>
      )}
    </section>
  )
}
