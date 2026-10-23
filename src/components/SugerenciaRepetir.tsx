/**
 * Sugerencia automática: si el día que se ve está vacío y el anterior tiene
 * comidas, ofrece repetirlas con un toque (o elegir cuáles). Se puede descartar.
 */
import { useEffect, useState } from 'react'
import { History, X } from 'lucide-react'
import { api } from '../lib/api.ts'
import { entero } from '../lib/formato.ts'
import { hoyISO, sumarDias } from '../lib/fechas.ts'
import { TIPOS_COMIDA, type Comida, type Resumen } from '../lib/tipos.ts'

const CLAVE = 'nf:repetir-descartado'

export function SugerenciaRepetir({
  fecha,
  resumen,
  onCopiado,
  onElegir,
}: {
  fecha: string
  resumen: Resumen
  onCopiado: (hasta: string, comidas: Comida[]) => void
  onElegir: (desde: string) => void
}) {
  const vacio = TIPOS_COMIDA.every((t) => !(resumen.comidas[t]?.length))
  const ayer = sumarDias(fecha, -1)
  const [previo, setPrevio] = useState<{ n: number; kcal: number } | null>(null)
  const [descartado, setDescartado] = useState(() => {
    try { return localStorage.getItem(CLAVE) === fecha } catch { return false }
  })
  const [copiando, setCopiando] = useState(false)

  useEffect(() => {
    setPrevio(null)
    try { setDescartado(localStorage.getItem(CLAVE) === fecha) } catch { /* sin storage */ }
    if (!vacio || fecha > hoyISO()) return
    const ac = new AbortController()
    api
      .resumen(ayer, ac.signal)
      .then((r) => {
        const todas = TIPOS_COMIDA.flatMap((t) => r.comidas[t] ?? [])
        if (todas.length) setPrevio({ n: todas.length, kcal: todas.reduce((s, c) => s + c.calorias, 0) })
      })
      .catch(() => {})
    return () => ac.abort()
  }, [fecha, ayer, vacio])

  if (!vacio || !previo || descartado) return null

  async function copiarTodo() {
    setCopiando(true)
    try {
      const r = await api.copiarComidas({ desde: ayer, hasta: fecha })
      onCopiado(fecha, r.comidas)
    } catch {
      onElegir(ayer)
    } finally {
      setCopiando(false)
    }
  }

  return (
    <div data-testid="sugerencia-repetir" className="relative flex animate-fade-in flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-mint/30 bg-mint/10 p-4 pr-10 dark:border-mint/20 dark:bg-mint/5">
      <History size={20} strokeWidth={1.75} className="shrink-0 text-mint-600 dark:text-mint-400" />
      <div className="min-w-[10rem] flex-1">
        <p className="text-sm font-medium">¿Repetir lo del día anterior?</p>
        <p className="cifra text-xs text-neutral-500 dark:text-neutral-400">
          {previo.n} {previo.n === 1 ? 'comida' : 'comidas'} · {entero(previo.kcal)} kcal
        </p>
      </div>
      <div className="ml-auto flex items-center gap-1">
      <button type="button" onClick={() => onElegir(ayer)} className="rounded-lg px-2.5 py-1.5 text-sm text-neutral-600 hover:bg-white/60 dark:text-neutral-300 dark:hover:bg-neutral-800">
        Elegir
      </button>
      <button type="button" disabled={copiando} onClick={() => void copiarTodo()} className="rounded-lg bg-graphite px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-graphite">
        {copiando ? 'Copiando…' : 'Repetir todo'}
      </button>
      </div>
      <button
        type="button"
        aria-label="Descartar sugerencia"
        onClick={() => {
          setDescartado(true)
          try { localStorage.setItem(CLAVE, fecha) } catch { /* sin storage */ }
        }}
        className="absolute right-2 top-2 rounded-full p-1.5 text-neutral-500 dark:text-neutral-400 hover:text-graphite dark:hover:text-white"
      >
        <X size={16} />
      </button>
    </div>
  )
}
