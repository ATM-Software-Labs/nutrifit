/**
 * Análisis de una foto: lado mayor 768 px, WebP 0.70 (JPEG si no hay WebP),
 * como mucho 100 KB y sin EXIF → /api/comidas/analizar con Turnstile.
 * Errores: 429 (límite diario) y 503 (IA no disponible) → manual.
 */
import { useEffect, useRef, useState } from 'react'
import { CircleAlert, PenLine, RotateCcw } from 'lucide-react'
import { Sheet } from './ui/Sheet.tsx'
import { Button } from './ui/Button.tsx'
import { useTurnstile } from '../hooks/useTurnstile.ts'
import { api, ApiError } from '../lib/api.ts'
import { blobDesdeDataUrl, compressFoodImage, ErrorImagen } from '../lib/imagen.ts'
import type { ResultadoAnalisis } from '../lib/tipos.ts'

type Estado = { fase: 'procesando' } | { fase: 'error'; mensaje: string; manual: boolean; reintentar: boolean }

export default function ScannerComida({
  archivo,
  onClose,
  onResultado,
  onManual,
}: {
  archivo: File
  onClose: () => void
  onResultado: (r: ResultadoAnalisis, imagenUrl: string) => void
  onManual: (imagenUrl: string | null) => void
}) {
  const [estado, setEstado] = useState<Estado>({ fase: 'procesando' })
  const [miniatura, setMiniatura] = useState<string | null>(null)
  const [intento, setIntento] = useState(0)
  const { contenedorRef, obtenerToken } = useTurnstile('analizar')
  const entregado = useRef(false)

  useEffect(() => {
    let cancelado = false
    setEstado({ fase: 'procesando' })
    ;(async () => {
      try {
        const dataUrl = await compressFoodImage(archivo)
        if (cancelado) return
        setMiniatura(dataUrl)
        const token = await obtenerToken()
        const r = await api.analizar(blobDesdeDataUrl(dataUrl), token)
        if (cancelado) return
        entregado.current = true
        onResultado(r.resultado, dataUrl)
      } catch (e) {
        if (cancelado) return
        if (e instanceof ErrorImagen) setEstado({ fase: 'error', mensaje: e.message, manual: true, reintentar: false })
        else if (e instanceof ApiError && e.status === 429)
          setEstado({ fase: 'error', mensaje: e.message || 'Has alcanzado el límite de análisis de hoy.', manual: true, reintentar: false })
        else if (e instanceof ApiError && e.status === 503)
          setEstado({ fase: 'error', mensaje: 'La IA no está disponible ahora mismo. Puedes añadir la comida a mano.', manual: true, reintentar: true })
        else setEstado({ fase: 'error', mensaje: e instanceof Error ? e.message : 'No se pudo analizar la foto.', manual: true, reintentar: true })
      }
    })()
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archivo, intento])

  return (
    <Sheet abierto onClose={onClose} titulo={estado.fase === 'procesando' ? 'Analizando foto...' : 'No hemos podido analizarlo'} ancho="sm">
      <div className="relative mx-auto aspect-square w-full max-w-[280px] overflow-hidden rounded-3xl bg-neutral-100 dark:bg-neutral-900">
        {miniatura ? (
          <img src={miniatura} alt="Foto del plato" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full animate-pulse bg-neutral-200 dark:bg-neutral-800" role="status" aria-label="Analizando foto..." />
        )}
        {estado.fase === 'procesando' && (
          <div className="absolute inset-0" aria-hidden="true">
            <div className="absolute inset-0 bg-gradient-to-b from-mint/5 via-transparent to-mint/10" />
            <div className="absolute inset-x-0 h-0.5 animate-laser bg-mint shadow-[0_0_16px_4px_rgb(16_185_129_/_0.55)] motion-reduce:top-1/2" />
            {/* esquinas del visor */}
            <span className="absolute left-3 top-3 h-6 w-6 rounded-tl-xl border-l-2 border-t-2 border-white/90" />
            <span className="absolute right-3 top-3 h-6 w-6 rounded-tr-xl border-r-2 border-t-2 border-white/90" />
            <span className="absolute bottom-3 left-3 h-6 w-6 rounded-bl-xl border-b-2 border-l-2 border-white/90" />
            <span className="absolute bottom-3 right-3 h-6 w-6 rounded-br-xl border-b-2 border-r-2 border-white/90" />
          </div>
        )}
      </div>

      <div ref={contenedorRef} className="mt-4 flex justify-center empty:hidden" />

      {estado.fase === 'procesando' ? (
        <p className="mt-6 text-center text-sm text-neutral-500 dark:text-neutral-400" role="status" aria-live="polite">
          Analizando foto...
        </p>
      ) : (
        <div className="mt-6 space-y-4" role="alert">
          <p className="flex items-start gap-2.5 rounded-2xl bg-neutral-100 p-4 text-sm dark:bg-neutral-900">
            <CircleAlert size={18} className="mt-px shrink-0 text-fats" />
            <span>{estado.mensaje}</span>
          </p>
          <div className="flex gap-2">
            {estado.reintentar && (
              <Button variant="outline" block icon={<RotateCcw size={16} />} onClick={() => setIntento((i) => i + 1)}>
                Reintentar
              </Button>
            )}
            {estado.manual && (
              <Button
                block
                icon={<PenLine size={16} />}
                onClick={() => {
                  entregado.current = true
                  onManual(miniatura)
                }}
              >
                Añadir a mano
              </Button>
            )}
          </div>
        </div>
      )}
    </Sheet>
  )
}
