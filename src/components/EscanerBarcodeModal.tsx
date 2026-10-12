import { useEffect, useRef, useState } from 'react'
import { Barcode, Camera, Search, X } from 'lucide-react'
import { ApiError, api } from '../lib/api.ts'
import { Button } from './ui/Button.tsx'

interface ProductoDetectado {
  id: string
  nombre: string
  marca?: string
  calorias: number
  proteinas: number
  carbohidratos: number
  grasas: number
  codigo_barras?: string
}

interface Props {
  abierto: boolean
  alDetectar: (producto: ProductoDetectado) => void
  alCerrar: () => void
}

export function EscanerBarcodeModal({ abierto, alDetectar, alCerrar }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [codigoManual, setCodigoManual] = useState('')
  const [camaraActiva, setCamaraActiva] = useState(false)

  useEffect(() => {
    if (!abierto) return
    let stream: MediaStream | null = null
    let animationFrame: number
    let detectorActivo = true

    const iniciarCamara = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
          setCamaraActiva(true)
        }

        const BarcodeDetectorClass = (window as unknown as { BarcodeDetector?: new (opts?: { formats: string[] }) => { detect: (v: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector

        if (BarcodeDetectorClass) {
          const barcodeDetector = new BarcodeDetectorClass({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'qr_code'] })
          const detectar = async () => {
            if (!detectorActivo) return
            if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
              try {
                const barcodes = await barcodeDetector.detect(videoRef.current)
                if (barcodes.length > 0 && barcodes[0]?.rawValue) {
                  detectorActivo = false
                  void buscarCodigo(barcodes[0].rawValue)
                  return
                }
              } catch {
                // frame skip
              }
            }
            animationFrame = requestAnimationFrame(detectar)
          }
          detectar()
        }
      } catch {
        setError('No se pudo iniciar la cámara para escanear. Puedes introducir el código manualmente.')
      }
    }

    void iniciarCamara()

    return () => {
      detectorActivo = false
      if (stream) stream.getTracks().forEach((t) => t.stop())
      if (animationFrame) cancelAnimationFrame(animationFrame)
    }
  }, [abierto])

  const buscarCodigo = async (ean: string) => {
    const limpio = ean.trim()
    if (!limpio) return
    setCargando(true)
    setError(null)
    try {
      const data = await api.barcodeEan(limpio)
      if (data.producto) {
        alDetectar(data.producto)
        alCerrar()
      } else {
        setError(`No se encontraron datos para el código ${limpio} en Open Food Facts.`)
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error al consultar el producto')
    } finally {
      setCargando(false)
    }
  }

  if (!abierto) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fade-in"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-neutral-200 bg-white p-5 shadow-2xl dark:border-neutral-800 dark:bg-card-dark sm:p-6">
        <div className="flex items-center justify-between pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-mint-50 text-mint-600 dark:bg-mint-950 dark:text-mint-400">
              <Barcode size={20} strokeWidth={1.75} />
            </span>
            <div>
              <h3 className="text-base font-semibold text-graphite dark:text-neutral-100">Escanear código de barras</h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Open Food Facts (catálogo abierto)</p>
            </div>
          </div>
          <button
            type="button"
            onClick={alCerrar}
            className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
          >
            <X size={18} />
          </button>
        </div>

        {/* Visor de cámara con visor de enfoque */}
        <div className="relative aspect-4/3 w-full overflow-hidden rounded-2xl bg-neutral-900 border border-neutral-800">
          <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
          
          {camaraActiva ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
              <div className="relative h-32 w-52 rounded-xl border-2 border-mint/80 bg-mint/5 shadow-inner">
                <div className="absolute top-0 left-0 h-4 w-4 border-t-2 border-l-2 border-mint" />
                <div className="absolute top-0 right-0 h-4 w-4 border-t-2 border-r-2 border-mint" />
                <div className="absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 border-mint" />
                <div className="absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 border-mint" />
                {/* Línea de escaneo láser */}
                <div className="absolute left-2 right-2 top-1/2 h-0.5 bg-mint/90 shadow-[0_0_8px_#10b981] animate-pulse" />
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-neutral-500">
              <Camera size={28} strokeWidth={1.5} />
              <span className="text-xs">Iniciando cámara...</span>
            </div>
          )}

          {cargando && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 text-white backdrop-blur-xs">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-mint border-t-transparent" />
              <span className="text-xs font-medium">Buscando alimento en Open Food Facts…</span>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-600 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Introducción manual de código EAN */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (codigoManual.trim()) void buscarCodigo(codigoManual)
          }}
          className="mt-4 flex gap-2"
        >
          <input
            type="text"
            inputMode="numeric"
            placeholder="O escribe el código EAN (ej. 8410000...)"
            value={codigoManual}
            onChange={(e) => setCodigoManual(e.target.value)}
            className="flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm text-graphite focus:border-mint focus:outline-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
          />
          <Button type="submit" loading={cargando} disabled={!codigoManual.trim()} icon={<Search size={16} />}>
            Buscar
          </Button>
        </form>
      </div>
    </div>
  )
}
