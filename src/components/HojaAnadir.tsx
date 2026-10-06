import type { ChangeEvent, ReactNode } from 'react'
import { Camera, ImagePlus, PenLine } from 'lucide-react'
import { Sheet } from './ui/Sheet.tsx'
import { NOMBRE_TIPO, type TipoComida } from '../lib/tipos.ts'

function Opcion({ icono, titulo, desc, children }: { icono: ReactNode; titulo: string; desc: string; children?: ReactNode }) {
  return (
    <>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-mint-50 text-mint-600 dark:bg-mint-950 dark:text-mint-400">{icono}</span>
      <span className="flex-1 text-left">
        <span className="block font-medium">{titulo}</span>
        <span className="block text-sm text-neutral-500 dark:text-neutral-400">{desc}</span>
      </span>
      {children}
    </>
  )
}

const CLASE =
  'flex w-full cursor-pointer items-center gap-4 rounded-2xl border border-neutral-200 p-4 transition hover:border-neutral-300 hover:bg-neutral-50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-mint/60 dark:border-neutral-800 dark:hover:border-neutral-700 dark:hover:bg-neutral-900'

/** Elegir cómo añadir: cámara, galería o a mano. Los <input type=file> se abren con un gesto directo. */
export function HojaAnadir({
  abierto,
  tipo,
  onClose,
  onArchivo,
  onManual,
}: {
  abierto: boolean
  tipo: TipoComida
  onClose: () => void
  onArchivo: (f: File) => void
  onManual: () => void
}) {
  const elegir = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (f) onArchivo(f)
  }
  return (
    <Sheet abierto={abierto} onClose={onClose} titulo={`Añadir a ${NOMBRE_TIPO[tipo].toLowerCase()}`} descripcion="Analiza una foto con IA o introdúcelo a mano." ancho="sm">
      <div className="space-y-3">
        <label className={CLASE}>
          <Opcion icono={<Camera size={20} strokeWidth={1.75} />} titulo="Hacer foto" desc="Usa la cámara del móvil" />
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={elegir} data-autofocus />
        </label>
        <label className={CLASE}>
          <Opcion icono={<ImagePlus size={20} strokeWidth={1.75} />} titulo="Elegir de la galería" desc="JPEG, PNG, WebP o HEIC" />
          <input type="file" accept="image/*" className="sr-only" onChange={elegir} data-testid="input-galeria" />
        </label>
        <button type="button" className={CLASE} onClick={onManual}>
          <Opcion icono={<PenLine size={20} strokeWidth={1.75} />} titulo="Añadir manualmente" desc="Escribe el plato y sus macros" />
        </button>
      </div>
    </Sheet>
  )
}
