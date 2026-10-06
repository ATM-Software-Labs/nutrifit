import { useRef, useState, type DragEvent } from 'react'

/** Arrastrar y soltar una imagen (escritorio). Devuelve props para el contenedor y si hay algo encima. */
export function useSoltarImagen(onArchivo: (f: File) => void, onError?: (mensaje: string) => void) {
  const [encima, setEncima] = useState(false)
  const profundidad = useRef(0)
  const conArchivos = (e: DragEvent) => Array.from(e.dataTransfer.types).includes('Files')
  return {
    encima,
    props: {
      onDragEnter: (e: DragEvent) => {
        if (!conArchivos(e)) return
        e.preventDefault()
        profundidad.current++
        setEncima(true)
      },
      onDragOver: (e: DragEvent) => {
        if (!conArchivos(e)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
      },
      onDragLeave: () => {
        profundidad.current = Math.max(0, profundidad.current - 1)
        if (!profundidad.current) setEncima(false)
      },
      onDrop: (e: DragEvent) => {
        if (!conArchivos(e)) return
        e.preventDefault()
        profundidad.current = 0
        setEncima(false)
        const f = Array.from(e.dataTransfer.files).find((x) => x.type.startsWith('image/') || /\.(heic|heif)$/i.test(x.name))
        if (f) onArchivo(f)
        else onError?.('Suelta una imagen (JPEG, PNG, WebP o HEIC).')
      },
    },
  }
}
