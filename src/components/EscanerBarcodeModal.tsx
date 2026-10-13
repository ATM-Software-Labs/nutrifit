import { Component, useEffect, useRef, useState, type ReactNode } from 'react'
import { normalizarEan } from '../lib/ean.ts'
import { Barcode, Camera, Flashlight, ImageUp, RotateCcw, Search, X } from 'lucide-react'
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
  unidad?: 'g' | 'ml'
  envase?: number | null
  racion?: number | null
  unidades?: number | null
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

type Fuente = HTMLVideoElement | HTMLCanvasElement
type Detector = (v: Fuente, lienzo: HTMLCanvasElement) => Promise<string | null>
const dims = (v: Fuente) => (v instanceof HTMLVideoElement ? [v.videoWidth, v.videoHeight] : [v.width, v.height])
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
    const [w, h] = dims(v)
    if (!w || !h) return null
    // En vídeo, franja central; en una foto, la imagen entera.
    const foto = v instanceof HTMLCanvasElement
    const fw = foto ? w : Math.round(w * 0.8), fh = foto ? h : Math.round(h * 0.45)
    const escala = Math.min(1, (foto ? 1600 : 960) / fw)
    lienzo.width = Math.round(fw * escala); lienzo.height = Math.round(fh * escala)
    lienzo.getContext('2d', { willReadFrequently: true })!.drawImage(v, (w - fw) / 2, (h - fh) / 2, fw, fh, 0, 0, lienzo.width, lienzo.height)
    try {
      return lector.decodeWithState(new zx.BinaryBitmap(new zx.HybridBinarizer(new HTMLCanvasElementLuminanceSource(lienzo)))).getText()
    } catch {
      return null
    }
  }
}

/** Mensaje claro según el fallo de getUserMedia (permiso, sin cámara, ocupada, contexto inseguro). */
export function mensajeCamara(e: unknown): string {
  const n = e instanceof Error ? e.name : ''
  const ios = /iP(hone|ad|od)/.test(navigator.userAgent)
  if (n === 'NotAllowedError' || n === 'SecurityError')
    return ios
      ? 'No hay permiso para la cámara. En Ajustes › Safari › Cámara elige «Preguntar» o «Permitir» y vuelve a abrir el escáner. También puedes hacer una foto del código.'
      : 'No hay permiso para la cámara. Toca el candado o «ⓘ» junto a la dirección (o en la app: mantén pulsado el icono › Información › Permisos) y permite la cámara. También puedes hacer una foto del código.'
  if (n === 'NotFoundError' || n === 'OverconstrainedError') return 'No encontramos una cámara disponible. Haz una foto del código o escríbelo debajo.'
  if (n === 'NotReadableError' || n === 'AbortError') return 'Otra app está usando la cámara. Ciérrala y pulsa «Reintentar».'
  if (e instanceof Error && e.message === 'camara') return 'La cámara tarda demasiado en abrirse. Pulsa «Reintentar» o haz una foto del código.'
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) return 'Este navegador no permite usar la cámara aquí. Haz una foto del código o escríbelo debajo.'
  return 'No se pudo usar la cámara. Pulsa «Reintentar», haz una foto del código o escríbelo debajo.'
}

/** Abre la trasera; si las restricciones fallan, cualquier cámara. */
async function abrirCamara(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) throw new DOMException('sin getUserMedia', 'NotFoundError')
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } })
  } catch (e) {
    const n = e instanceof Error ? e.name : ''
    if (n === 'NotAllowedError' || n === 'SecurityError') throw e
    return navigator.mediaDevices.getUserMedia({ audio: false, video: true })
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
  const [fallaCamara, setFallaCamara] = useState(false)
  const [linterna, setLinterna] = useState<null | boolean>(null)
  const pistaRef = useRef<MediaStreamTrack | null>(null)
  const detectorRef = useRef<Promise<Detector> | null>(null)
  const obtenerDetector = () => (detectorRef.current ??= crearDetector().catch((e) => { detectorRef.current = null; throw e }))
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
      pistaRef.current = null
      stream = null
      if (videoRef.current) videoRef.current.srcObject = null
    }

    ;(async () => {
      try {
        setFallaCamara(false)
        void obtenerDetector().catch(() => {}) // precarga en paralelo (ZXing es un chunk aparte)
        stream = await conTiempo(abrirCamara(), 12000, 'camara')
        if (!activo) return parar()
        const pista = stream.getVideoTracks()[0]
        pistaRef.current = pista ?? null
        const caps = (pista?.getCapabilities?.() ?? {}) as { torch?: boolean }
        if (caps.torch) setLinterna(false)
        void pista?.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] }).catch(() => {})
        const v = videoRef.current
        if (!v) return parar()
        v.srcObject = stream
        await v.play().catch(() => {})
        setCamaraActiva(true)
        let detectar: Detector
        try {
          detectar = await obtenerDetector()
        } catch {
          // Chunk del lector no disponible (sin conexión o versión vieja tras actualizar).
          parar()
          if (vivo.current) { setFallaCamara(true); setError('No se pudo cargar el lector de códigos. Comprueba la conexión y pulsa «Reintentar», o escribe el código debajo.') }
          return
        }
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
      } catch (e) {
        parar()
        if (vivo.current) { setFallaCamara(true); setError(mensajeCamara(e)) }
      }
    })()

    return parar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, ronda])

  const reintentar = () => { setError(null); setNoEncontrado(null); setCamaraActiva(false); setLinterna(null); setRonda((r) => r + 1) }

  const alternarLinterna = async () => {
    const p = pistaRef.current
    if (!p || linterna === null) return
    try { await p.applyConstraints({ advanced: [{ torch: !linterna } as MediaTrackConstraintSet] }); setLinterna(!linterna) } catch { setLinterna(null) }
  }

  /** Foto del código (sin vídeo en directo): útil en iOS o si se deniega la cámara. */
  const leerFoto = async (archivo: File) => {
    setError(null)
    setCargando(true)
    try {
      const bmp = await createImageBitmap(archivo)
      const c = document.createElement('canvas')
      c.width = bmp.width; c.height = bmp.height
      c.getContext('2d')!.drawImage(bmp, 0, 0)
      bmp.close?.()
      const detectar = await obtenerDetector()
      const crudo = await detectar(c, document.createElement('canvas'))
      setCargando(false)
      if (!crudo) { setError('No vemos un código de barras en la foto. Acércate, que salga recto y nítido, o escríbelo debajo.'); return }
      void buscarCodigo(crudo)
    } catch {
      setCargando(false)
      setError('No se pudo leer la foto. Escribe el código debajo.')
    }
  }

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
            aria-label="Cerrar escáner"
            className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
          >
            <X size={18} />
          </button>
        </div>

        {/* Visor de cámara con visor de enfoque */}
        <div className="relative aspect-4/3 w-full overflow-hidden rounded-2xl bg-neutral-900 border border-neutral-800">
          <video ref={videoRef} className="h-full w-full object-cover" playsInline muted autoPlay aria-label="Vista de la cámara" />
          
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
          ) : fallaCamara ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center text-neutral-300">
              <Camera size={28} strokeWidth={1.5} aria-hidden="true" />
              <div className="flex flex-wrap justify-center gap-2">
                <button type="button" onClick={reintentar} className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/20"><RotateCcw size={14} aria-hidden="true" />Reintentar</button>
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-mint-700 px-3 py-2 text-xs font-semibold text-white focus-within:ring-4 focus-within:ring-mint/30">
                  <ImageUp size={14} aria-hidden="true" />Foto del código
                  <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void leerFoto(f) }} />
                </label>
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-neutral-500" role="status">
              <Camera size={28} strokeWidth={1.5} aria-hidden="true" />
              <span className="text-xs">Iniciando cámara…</span>
            </div>
          )}
          {camaraActiva && linterna !== null && (
            <button type="button" onClick={() => void alternarLinterna()} aria-pressed={linterna} aria-label={linterna ? 'Apagar linterna' : 'Encender linterna'} className={`absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full ${linterna ? 'bg-amber-300 text-black' : 'bg-black/50 text-white'}`}>
              <Flashlight size={18} aria-hidden="true" />
            </button>
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
                <label className="cursor-pointer rounded-xl bg-mint-700 px-3 py-2 text-xs font-semibold text-white focus-within:ring-4 focus-within:ring-mint/30 hover:bg-mint-800">
                  Foto de la etiqueta
                  <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) { alFotoEtiqueta(f, noEncontrado); alCerrar() } }} />
                </label>
              )}
              {alManual && <button type="button" onClick={() => { alManual(noEncontrado); alCerrar() }} className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-semibold dark:border-neutral-700">Añadir a mano</button>}
              <button type="button" onClick={reintentar} className="rounded-xl px-3 py-2 text-xs font-semibold text-mint-700 dark:text-mint-400">Volver a escanear</button>
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
            placeholder="O escribe el código"
            aria-label="Código de barras (8 o 13 cifras)"
            autoComplete="off"
            maxLength={14}
            value={codigoManual}
            onChange={(e) => setCodigoManual(e.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm text-graphite focus:border-mint focus:outline-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
          />
          <Button type="submit" className="shrink-0" loading={cargando} disabled={!codigoManual.trim()} icon={<Search size={16} />}>
            Buscar
          </Button>
        </form>
      </div>
    </div>
  )
}
