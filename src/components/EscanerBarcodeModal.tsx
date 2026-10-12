import { Component, useEffect, useRef, useState, type ReactNode } from 'react'
import { normalizarEan } from '../lib/ean.ts'
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
  /** Si el producto no aparece: foto de la etiqueta (análisis con IA). */
  alFotoEtiqueta?: (archivo: File, codigo: string) => void
  /** Si el producto no aparece: alta manual con el código ya puesto. */
  alManual?: (codigo: string) => void
}

type Detector = (v: HTMLVideoElement, lienzo: HTMLCanvasElement) => Promise<string | null>
type BarcodeDetectorCtor = { new (o?: { formats: string[] }): { detect: (v: CanvasImageSource) => Promise<{ rawValue: string }[]> }; getSupportedFormats?: () => Promise<string[]> }
const FORMATOS = ['ean_13', 'ean_8', 'upc_a', 'upc_e']
const INTERVALO_MS = 140
const TIEMPO_BUSQUEDA_MS = 15000

/** BarcodeDetector nativo si sabe leer EAN; si no (WebView de Android, iOS), ZXing. */
async function crearDetector(): Promise<Detector> {
  const BD = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector
  if (BD) {
    const soportados = await BD.getSupportedFormats?.().catch(() => [] as string[])
    if (!soportados || soportados.includes('ean_13')) {
      const d = new BD({ formats: FORMATOS })
      return async (v) => (await d.detect(v))[0]?.rawValue ?? null
    }
  }
  const [{ HTMLCanvasElementLuminanceSource }, zx] = await Promise.all([import('@zxing/browser'), import('@zxing/library')])
  const lector = new zx.MultiFormatReader()
  const pistas = new Map<import('@zxing/library').DecodeHintType, unknown>([
    [zx.DecodeHintType.POSSIBLE_FORMATS, [zx.BarcodeFormat.EAN_13, zx.BarcodeFormat.EAN_8, zx.BarcodeFormat.UPC_A, zx.BarcodeFormat.UPC_E]],
    [zx.DecodeHintType.TRY_HARDER, true],
  ])
  lector.setHints(pistas)
  return async (v, lienzo) => {
    // Franja central (donde está la guía), reducida: rápido en móviles medios.
    const w = v.videoWidth, h = v.videoHeight
    if (!w || !h) return null
    const fw = Math.round(w * 0.8), fh = Math.round(h * 0.45)
    const escala = Math.min(1, 960 / fw)
    lienzo.width = Math.round(fw * escala); lienzo.height = Math.round(fh * escala)
    lienzo.getContext('2d', { willReadFrequently: true })!.drawImage(v, (w - fw) / 2, (h - fh) / 2, fw, fh, 0, 0, lienzo.width, lienzo.height)
    try {
      return lector.decodeWithState(new zx.BinaryBitmap(new zx.HybridBinarizer(new HTMLCanvasElementLuminanceSource(lienzo)))).getText()
    } catch {
      return null
    }
  }
}

const conTiempo = <T,>(p: Promise<T>, ms: number, msg: string) => Promise.race([p, new Promise<never>((_, r) => setTimeout(() => r(new Error(msg)), ms))])

export function EscanerBarcodeModal(props: Props) {
  return (
    <LimiteError alCerrar={props.alCerrar}>
      <Escaner {...props} />
    </LimiteError>
  )
}

/** Si algo revienta dentro del escáner, se muestra un aviso y la cámara se libera al desmontar. */
class LimiteError extends Component<{ alCerrar: () => void; children: ReactNode }, { fallo: boolean }> {
  state = { fallo: false }
  static getDerivedStateFromError() { return { fallo: true } }
  componentDidCatch(e: unknown) { console.error('[escáner]', e) }
  render() {
    if (!this.state.fallo) return this.props.children
    return (
      <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
        <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center dark:bg-card-dark">
          <p className="font-semibold">El escáner ha tenido un problema</p>
          <p className="mt-1 text-sm text-neutral-500">Ciérralo y vuelve a intentarlo, o escribe el código a mano.</p>
          <Button className="mt-4" onClick={this.props.alCerrar}>Cerrar</Button>
        </div>
      </div>
    )
  }
}

function Escaner({ abierto, alDetectar, alCerrar, alFotoEtiqueta, alManual }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [noEncontrado, setNoEncontrado] = useState<string | null>(null)
  const [codigoManual, setCodigoManual] = useState('')
  const [camaraActiva, setCamaraActiva] = useState(false)
  const [ronda, setRonda] = useState(0)
  const vivo = useRef(true)
  useEffect(() => () => { vivo.current = false }, [])

  useEffect(() => {
    if (!abierto) return
    let stream: MediaStream | null = null
    let timer = 0
    let activo = true
    let previo = ''
    const lienzo = document.createElement('canvas')

    const parar = () => {
      activo = false
      window.clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
      stream = null
      if (videoRef.current) videoRef.current.srcObject = null
    }

    ;(async () => {
      try {
        stream = await conTiempo(navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } }), 10000, 'camara')
        if (!activo) return parar()
        const pista = stream.getVideoTracks()[0]
        void pista?.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] }).catch(() => {})
        const v = videoRef.current
        if (!v) return parar()
        v.srcObject = stream
        await v.play().catch(() => {})
        setCamaraActiva(true)
        const detectar = await crearDetector()
        const vuelta = async () => {
          if (!activo) return
          if (v.readyState >= v.HAVE_ENOUGH_DATA) {
            const crudo = await detectar(v, lienzo).catch(() => null)
            const ean = crudo ? normalizarEan(crudo) : null
            // Dos lecturas iguales seguidas: evita búsquedas con códigos mal leídos.
            if (ean && ean === previo) {
              parar()
              void buscarCodigo(ean)
              return
            }
            previo = ean ?? previo
          }
          if (activo) timer = window.setTimeout(vuelta, INTERVALO_MS)
        }
        void vuelta()
      } catch {
        parar()
        if (vivo.current) setError('No se pudo usar la cámara. Escribe el código de barras debajo.')
      }
    })()

    return parar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, ronda])

  const buscarCodigo = async (entrada: string) => {
    const limpio = entrada.replace(/\D/g, '')
    if (!limpio) return
    const ean = normalizarEan(limpio)
    setError(null)
    setNoEncontrado(null)
    if (!ean) {
      setError(`El código ${limpio} no es válido (revisa los números; un EAN tiene 8 o 13 cifras).`)
      return
    }
    setCargando(true)
    try {
      const data = await conTiempo(api.barcodeEan(ean), TIEMPO_BUSQUEDA_MS, 'tiempo')
      if (!vivo.current) return
      if (data.producto) {
        alDetectar(data.producto)
        alCerrar()
      } else setNoEncontrado(ean)
    } catch (e) {
      if (!vivo.current) return
      if (e instanceof ApiError && e.status === 404) setNoEncontrado(ean)
      else if (e instanceof Error && e.message === 'tiempo') { setNoEncontrado(ean); setError('La búsqueda ha tardado demasiado.') }
      else setError(e instanceof ApiError ? e.message : 'No hemos podido consultar el producto. Revisa tu conexión.')
    } finally {
      if (vivo.current) setCargando(false)
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
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Centra el código en el recuadro</p>
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
              <span className="text-xs font-medium">Buscando el producto…</span>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-600 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </div>
        )}

        {noEncontrado && (
          <div className="mt-3 rounded-2xl border border-neutral-200 p-3 text-sm dark:border-neutral-800">
            <p className="font-medium">No encontramos el producto {noEncontrado}</p>
            <p className="mt-0.5 text-xs text-neutral-500">Haz una foto de la tabla nutricional o añádelo a mano.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {alFotoEtiqueta && (
                <label className="cursor-pointer rounded-xl bg-mint px-3 py-2 text-xs font-semibold text-white">
                  Foto de la etiqueta
                  <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) { alFotoEtiqueta(f, noEncontrado); alCerrar() } }} />
                </label>
              )}
              {alManual && <button type="button" onClick={() => { alManual(noEncontrado); alCerrar() }} className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-semibold dark:border-neutral-700">Añadir a mano</button>}
              <button type="button" onClick={() => { setNoEncontrado(null); setError(null); setCamaraActiva(false); setRonda((r) => r + 1) }} className="rounded-xl px-3 py-2 text-xs font-semibold text-mint-700 dark:text-mint-400">Volver a escanear</button>
            </div>
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
            placeholder="O escribe el código (ej. 8412700012955)"
            autoComplete="off"
            maxLength={14}
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
