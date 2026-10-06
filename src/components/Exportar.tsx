/**
 * Exportar datos: CSV (comidas, peso o agua) desde /api/exportar, e informe
 * PDF «ligero» = vista HTML optimizada para imprimir + window.print()
 * (el navegador permite «Guardar como PDF»). Todo se carga bajo demanda.
 */
import { lazy, Suspense, useState } from 'react'
import { createPortal } from 'react-dom'
import { Droplet, FileText, Scale, UtensilsCrossed } from 'lucide-react'
import { Sheet } from './ui/Sheet.tsx'
import { Button } from './ui/Button.tsx'
import { Input } from './ui/Input.tsx'
import { useToast } from './ui/Toast.tsx'
import { api } from '../lib/api.ts'
import { esNativa } from '../lib/plataforma.ts'
import { desdeISO, hoyISO } from '../lib/fechas.ts'
import type { Historial, Usuario } from '../lib/tipos.ts'

const Informe = lazy(() => import('./Informe.tsx'))

const MAX_CSV = 366
const MAX_INFORME = 93
const dias = (a: string, b: string) => Math.round((desdeISO(b).getTime() - desdeISO(a).getTime()) / 86_400_000) + 1

function guardarBlob(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export default function Exportar({ usuario, desdeInicial, hastaInicial, onClose }: { usuario: Usuario; desdeInicial: string; hastaInicial: string; onClose: () => void }) {
  const [desde, setDesde] = useState(desdeInicial)
  const [hasta, setHasta] = useState(hastaInicial)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [informe, setInforme] = useState<Historial | null>(null)
  const toast = useToast()
  const hoy = hoyISO()
  const n = desde && hasta ? dias(desde, hasta) : 0
  const errorRango = !desde || !hasta ? 'Elige las dos fechas.' : n < 1 ? 'La fecha final debe ser posterior a la inicial.' : n > MAX_CSV ? `Máximo ${MAX_CSV} días.` : null

  async function csv(tipo: 'comidas' | 'peso' | 'agua') {
    setOcupado(tipo)
    try {
      const { blob, nombre } = await api.exportarCsv(tipo, desde, hasta)
      guardarBlob(blob, nombre)
      toast({ tipo: 'exito', mensaje: `Descargado ${nombre}` })
    } catch (e) {
      toast({ tipo: 'error', mensaje: e instanceof Error ? e.message : 'No se pudo exportar.' })
    } finally {
      setOcupado(null)
    }
  }

  async function pdf() {
    setOcupado('pdf')
    try {
      const h = await api.historial(desde, hasta)
      setInforme(h)
    } catch (e) {
      toast({ tipo: 'error', mensaje: e instanceof Error ? e.message : 'No se pudo preparar el informe.' })
    } finally {
      setOcupado(null)
    }
  }

  const i = { size: 18, strokeWidth: 1.75 }
  return (
    <>
      <Sheet abierto onClose={onClose} titulo="Exportar datos" descripcion="Descarga tus registros en CSV (Excel, Numbers, Sheets) o un informe en PDF." ancho="md">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Desde" type="date" value={desde} max={hasta || hoy} onChange={(e) => setDesde(e.target.value)} data-autofocus />
          <Input label="Hasta" type="date" value={hasta} min={desde} max={hoy} onChange={(e) => setHasta(e.target.value)} />
        </div>
        {errorRango ? (
          <p role="alert" className="mt-2 text-sm text-protein">
            {errorRango}
          </p>
        ) : (
          <p className="cifra mt-2 text-xs text-neutral-500 dark:text-neutral-400">{n === 1 ? '1 día' : `${n} días`}</p>
        )}

        <p className="etiqueta mb-2 mt-6">CSV</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <Button variant="outline" icon={<UtensilsCrossed {...i} />} loading={ocupado === 'comidas'} disabled={!!errorRango || !!ocupado} onClick={() => void csv('comidas')}>
            Comidas
          </Button>
          <Button variant="outline" icon={<Scale {...i} />} loading={ocupado === 'peso'} disabled={!!errorRango || !!ocupado} onClick={() => void csv('peso')}>
            Peso
          </Button>
          <Button variant="outline" icon={<Droplet {...i} />} loading={ocupado === 'agua'} disabled={!!errorRango || !!ocupado} onClick={() => void csv('agua')}>
            Agua
          </Button>
        </div>
        <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">Separado por «;» y con coma decimal, listo para Excel en español.</p>

        {!esNativa && (
          <>
            <p className="etiqueta mb-2 mt-6">Informe</p>
            <Button block icon={<FileText {...i} />} loading={ocupado === 'pdf'} disabled={!!errorRango || !!ocupado || n > MAX_INFORME} onClick={() => void pdf()}>
              Informe PDF
            </Button>
            <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
              {n > MAX_INFORME ? `El informe admite hasta ${MAX_INFORME} días.` : 'Se abre el diálogo de impresión: elige «Guardar como PDF».'}
            </p>
          </>
        )}
      </Sheet>
      {informe &&
        createPortal(
          <Suspense fallback={null}>
            <Informe datos={informe} usuario={usuario} onTerminar={() => setInforme(null)} />
          </Suspense>,
          document.body,
        )}
    </>
  )
}
