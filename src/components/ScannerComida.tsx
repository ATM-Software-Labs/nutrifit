/**
 * Análisis de una foto: lado mayor 1024 px (baja si pasa de 130 KB), WebP 0.72–0.78
 * (JPEG a 0.75 si no hay WebP), sin EXIF. En producción la foto va a
 * api.trujillomingorance.com con un ticket; en localhost sigue en /api/alimentos/escanear.
 * Un fallo de red se reintenta solo, con espera 1 s y luego 2 s.
 * Un límite corto enseña la cuenta atrás y reintenta una vez.
 */
import { useEffect, useRef, useState } from 'react'
import { Sheet } from './ui/Sheet.tsx'
import { FalloAnalisis } from './FalloAnalisis.tsx'
import { useTurnstile } from '../hooks/useTurnstile.ts'
import { api } from '../lib/api.ts'
import { falloDeAnalisis, type FalloAnalisisUi } from '../lib/falloAnalisis.ts'
import { blobDesdeDataUrl, compressFoodImage } from '../lib/imagen.ts'
import { resultadoDesdePlato } from '../lib/platoEscaneo.ts'
import { useIdioma } from '../hooks/useIdioma.ts'
import type { ResultadoAnalisis } from '../lib/tipos.ts'

type Estado =
  | { fase: 'comprimiendo' }
  | { fase: 'analizando' }
  | { fase: 'error'; fallo: FalloAnalisisUi; cuentaAtras: number }

export default function ScannerComida({
  archivo,
  onClose,
  onResultado,
  onManual,
  onElegirOtra,
}: {
  archivo: File
  onClose: () => void
  onResultado: (r: ResultadoAnalisis, imagenUrl: string) => void
  onManual: (imagenUrl: string | null) => void
  onElegirOtra?: () => void
}) {
  const { t } = useIdioma()
  const [estado, setEstado] = useState<Estado>({ fase: 'comprimiendo' })
  const [miniatura, setMiniatura] = useState<string | null>(null)
  const [intento, setIntento] = useState(0)
  const { contenedorRef, obtenerToken } = useTurnstile('analizar')
  const entregado = useRef(false)

  useEffect(() => {
    let cancelado = false
    let timer = 0
    let pulso = 0
    setEstado({ fase: 'comprimiendo' })
    ;(async () => {
      try {
        const dataUrl = await compressFoodImage(archivo)
        if (cancelado) return
        setMiniatura(dataUrl)
        setEstado({ fase: 'analizando' })
        const token = await obtenerToken()
        const plato = await api.escanear(blobDesdeDataUrl(dataUrl), token)
        if (cancelado) return
        entregado.current = true
        onResultado(resultadoDesdePlato(plato), dataUrl)
      } catch (e) {
        if (cancelado) return
        const fallo = falloDeAnalisis(e)
        const tope = fallo.codigo === 'RATE_LIMIT_EXCEEDED' ? 1 : 2
        if (fallo.auto && intento < tope) {
          const segundos = fallo.esperaSeg ?? 2 ** intento
          const espera = Math.max(1, segundos) * 1000
          const inicio = Date.now()
          setEstado({ fase: 'error', fallo, cuentaAtras: Math.max(1, Math.round(espera / 1000)) })
          pulso = window.setInterval(() => {
            const quedan = Math.max(0, Math.ceil((espera - (Date.now() - inicio)) / 1000))
            setEstado((prev) => (prev.fase === 'error' ? { ...prev, cuentaAtras: quedan } : prev))
          }, 250)
          timer = window.setTimeout(() => {
            if (!cancelado) setIntento((i) => i + 1)
          }, espera)
          return
        }
        setEstado({ fase: 'error', fallo, cuentaAtras: 0 })
      }
    })()
    return () => {
      cancelado = true
      window.clearTimeout(timer)
      window.clearInterval(pulso)
    }
    // obtenerToken cambia de identidad; el efecto solo debe repetirse al reintentar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archivo, intento])

  const procesando = estado.fase !== 'error'
  const texto =
    estado.fase === 'comprimiendo' ? t('scan.comprimiendo') : estado.fase === 'analizando' ? t('scan.macros') : ''

  return (
    <Sheet abierto onClose={onClose} titulo={procesando ? t('scan.analizando') : 'No hemos podido analizarlo'} ancho="sm">
      <div className="relative mx-auto aspect-square w-full max-w-[280px] overflow-hidden rounded-3xl bg-neutral-100 dark:bg-neutral-900">
        {miniatura ? (
          <img src={miniatura} alt="Foto del plato" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full animate-pulse bg-neutral-200 dark:bg-neutral-800" role="status" aria-label={t('scan.comprimiendo')} />
        )}
        {procesando && (
          <div className="absolute inset-0" aria-hidden="true">
            <div className="absolute inset-0 bg-gradient-to-b from-mint/5 via-transparent to-mint/10" />
            <div className="absolute inset-x-0 h-0.5 animate-laser bg-mint shadow-[0_0_16px_4px_rgb(16_185_129_/_0.55)] motion-reduce:top-1/2" />
            <span className="absolute left-3 top-3 h-6 w-6 rounded-tl-xl border-l-2 border-t-2 border-white/90" />
            <span className="absolute right-3 top-3 h-6 w-6 rounded-tr-xl border-r-2 border-t-2 border-white/90" />
            <span className="absolute bottom-3 left-3 h-6 w-6 rounded-bl-xl border-b-2 border-l-2 border-white/90" />
            <span className="absolute bottom-3 right-3 h-6 w-6 rounded-br-xl border-b-2 border-r-2 border-white/90" />
          </div>
        )}
      </div>

      <div ref={contenedorRef} className="mt-4 flex justify-center empty:hidden" />

      {procesando ? (
        <p className="mt-6 text-center text-sm text-neutral-500 dark:text-neutral-400" role="status" aria-live="polite">
          {texto}
        </p>
      ) : (
        <FalloAnalisis
          fallo={estado.fallo}
          cuentaAtras={estado.cuentaAtras}
          onReintentar={() => setIntento((i) => i + 1)}
          onElegirOtra={onElegirOtra ?? onClose}
          onManual={
            estado.fallo.manual
              ? () => {
                  entregado.current = true
                  onManual(miniatura)
                }
              : undefined
          }
        />
      )}
    </Sheet>
  )
}
