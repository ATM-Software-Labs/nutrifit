import type { ChangeEvent, ReactNode } from 'react'
import { Camera, ImagePlus, PenLine, Search, Sparkles } from 'lucide-react'
import { Sheet } from './ui/Sheet.tsx'
import { cx } from './ui/cx.ts'
import { useToast } from './ui/Toast.tsx'
import { useSoltarImagen } from '../hooks/useSoltarImagen.ts'
import { ESCRITORIO, useMedia } from '../hooks/useMedia.ts'
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

/**
 * Elegir cómo añadir: cámara, galería/subir foto, describir con texto, buscar en
 * la base de alimentos o a mano. Los <input type=file> se abren con un gesto
 * directo. En escritorio no hay cámara y se puede soltar la foto encima.
 */
export function HojaAnadir({
  abierto,
  tipo,
  onClose,
  onArchivo,
  onManual,
  onTexto,
  onBuscar,
}: {
  abierto: boolean
  tipo: TipoComida
  onClose: () => void
  onArchivo: (f: File) => void
  onManual: () => void
  onTexto: () => void
  onBuscar: () => void
}) {
  const escritorio = useMedia(ESCRITORIO)
  const toast = useToast()
  const { encima, props } = useSoltarImagen(onArchivo, (mensaje) => toast({ tipo: 'error', mensaje }))
  const elegir = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (f) onArchivo(f)
  }
  return (
    <Sheet abierto={abierto} onClose={onClose} titulo={`Añadir a ${NOMBRE_TIPO[tipo].toLowerCase()}`} descripcion="Con una foto, describiéndolo, buscando el alimento o a mano." ancho="sm">
      <div className="space-y-3">
        {!escritorio && (
          <label className={CLASE}>
            <Opcion icono={<Camera size={20} strokeWidth={1.75} />} titulo="Hacer foto" desc="Usa la cámara del móvil" />
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={elegir} data-autofocus />
          </label>
        )}
        <label className={cx(CLASE, encima && 'border-mint bg-mint-50 dark:bg-mint-950')} {...(escritorio ? props : {})}>
          <Opcion
            icono={<ImagePlus size={20} strokeWidth={1.75} />}
            titulo={escritorio ? 'Subir foto' : 'Elegir de la galería'}
            desc={escritorio ? (encima ? 'Suéltala para analizarla' : 'Elige un archivo o arrástralo aquí') : 'JPEG, PNG, WebP o HEIC'}
          />
          <input type="file" accept="image/*" className="sr-only" onChange={elegir} data-testid="input-galeria" {...(escritorio ? { 'data-autofocus': true } : {})} />
        </label>
        <button type="button" className={CLASE} onClick={onTexto}>
          <Opcion icono={<Sparkles size={20} strokeWidth={1.75} />} titulo="Describir con texto" desc="«Dos huevos revueltos y una tostada»" />
        </button>
        <button type="button" className={CLASE} onClick={onBuscar}>
          <Opcion icono={<Search size={20} strokeWidth={1.75} />} titulo="Buscar alimento" desc="Base de alimentos y productos envasados" />
        </button>
        <button type="button" className={CLASE} onClick={onManual}>
          <Opcion icono={<PenLine size={20} strokeWidth={1.75} />} titulo="Añadir manualmente" desc="Escribe el plato y sus macros" />
        </button>
      </div>
    </Sheet>
  )
}
