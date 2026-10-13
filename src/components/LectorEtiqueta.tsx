/**
 * Foto de la tabla nutricional (producto sin código en las bases de datos).
 * Comprime en el móvil SIN fondo blanco (el texto tiene que leerse), llama a
 * /api/alimentos/etiqueta y pasa a la revisión con 100 g (o la ración del envase).
 * El usuario revisa y edita siempre antes de guardar.
 */
import { useEffect, useRef, useState } from 'react'
import { ScanText } from 'lucide-react'
import { Sheet } from './ui/Sheet.tsx'
import { Button } from './ui/Button.tsx'
import { api, ApiError } from '../lib/api.ts'
import { comprimirImagen } from '../lib/imagen.ts'
import type { ResultadoAnalisis } from '../lib/tipos.ts'

type Etiqueta = Awaited<ReturnType<typeof api.etiqueta>>['etiqueta']

const r1 = (v: number) => Math.round(v * 10) / 10

/** Resultado de revisión a partir de la etiqueta (exportado para tests). */
export function resultadoDeEtiqueta(e: Etiqueta, codigo?: string): ResultadoAnalisis {
  const gramos = e.racion && e.racion > 0 && e.racion <= 2000 ? Math.round(e.racion) : 100
  const f = gramos / 100
  const nombre = [e.nombre, e.marca && e.marca !== e.nombre ? `(${e.marca})` : ''].filter(Boolean).join(' ') || 'Producto de la etiqueta'
  const m = { calorias: Math.round(e.por100.calorias * f), proteinas: r1(e.por100.proteinas * f), carbohidratos: r1(e.por100.carbohidratos * f), grasas: r1(e.por100.grasas * f) }
  return {
    nombre_plato: nombre,
    display_name: nombre,
    descripcion: codigo ? `Código de barras: ${codigo}` : 'Leído de la etiqueta',
    categoria: 'snack',
    ingredientes: [{ nombre, gramos, serving_description: gramos === 100 ? `100 ${e.unidad}` : `1 ración (${gramos} ${e.unidad})`, ...m }],
    ...m,
  }
}

export default function LectorEtiqueta({ archivo, codigo, onClose, onResultado, onManual }: {
  archivo: File
  codigo?: string
  onClose: () => void
  onResultado: (r: ResultadoAnalisis) => void
  onManual: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const vivo = useRef(true)

  useEffect(() => {
    vivo.current = true
    void (async () => {
      try {
        const blob = await comprimirImagen(archivo)
        const r = await api.etiqueta(blob)
        if (vivo.current) onResultado(resultadoDeEtiqueta(r.etiqueta, codigo))
      } catch (e) {
        if (!vivo.current) return
        setError(e instanceof ApiError || e instanceof Error ? e.message : 'No hemos podido leer la etiqueta.')
      }
    })()
    return () => {
      vivo.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archivo])

  return (
    <Sheet abierto onClose={onClose} titulo="Leyendo la etiqueta" descripcion="Tabla de información nutricional del envase." ancho="sm">
      {!error ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center" role="status" aria-live="polite">
          <ScanText size={32} strokeWidth={1.5} className="animate-pulse text-mint-600" aria-hidden="true" />
          <p className="text-sm text-neutral-600 dark:text-neutral-300">Leyendo los valores por 100 g…</p>
        </div>
      ) : (
        <div className="py-4" role="alert">
          <p className="text-sm text-neutral-700 dark:text-neutral-200">{error}</p>
          <div className="mt-4 flex gap-2">
            <Button type="button" onClick={onManual} className="flex-1">Escribir los valores</Button>
            <Button type="button" variant="outline" onClick={onClose}>Cerrar</Button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
