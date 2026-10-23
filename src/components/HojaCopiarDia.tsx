/**
 * Copiar comidas de otro día: se elige el día origen (atajos o calendario), se
 * marcan comidas sueltas, secciones enteras o todo el día, y la fecha destino.
 */
import { useEffect, useMemo, useState } from 'react'
import { Check, CopyPlus } from 'lucide-react'
import { Sheet } from './ui/Sheet.tsx'
import { Button } from './ui/Button.tsx'
import { cx } from './ui/cx.ts'
import { api } from '../lib/api.ts'
import { entero } from '../lib/formato.ts'
import { emojiDe } from '../lib/miniaturaComida.ts'
import { fechaCorta, hoyISO, sumarDias } from '../lib/fechas.ts'
import { NOMBRE_TIPO, TIPOS_COMIDA, type Comida, type Resumen } from '../lib/tipos.ts'

const ATAJOS = [
  { dias: 1, etiqueta: 'Ayer' },
  { dias: 2, etiqueta: 'Anteayer' },
  { dias: 7, etiqueta: 'Hace 1 semana' },
] as const

function Casilla({ marcada, parcial }: { marcada: boolean; parcial?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
        marcada || parcial ? 'border-graphite bg-graphite text-white dark:border-white dark:bg-white dark:text-graphite' : 'border-neutral-300 dark:border-neutral-600',
      )}
    >
      {marcada ? <Check size={14} strokeWidth={2.5} /> : parcial ? <span className="h-0.5 w-2.5 rounded bg-current" /> : null}
    </span>
  )
}

export function HojaCopiarDia({
  abierto,
  destinoInicial,
  origenInicial,
  onClose,
  onCopiado,
}: {
  abierto: boolean
  destinoInicial: string
  origenInicial?: string
  onClose: () => void
  onCopiado: (hasta: string, comidas: Comida[]) => void
}) {
  const hoy = hoyISO()
  const [desde, setDesde] = useState(origenInicial ?? sumarDias(destinoInicial, -1))
  const [hasta, setHasta] = useState(destinoInicial)
  const [dia, setDia] = useState<Resumen | null>(null)
  const [cargando, setCargando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)
  const [elegidas, setElegidas] = useState<Set<string>>(new Set())
  const [copiando, setCopiando] = useState(false)

  useEffect(() => {
    if (!abierto) return
    setHasta(destinoInicial)
    setDesde(origenInicial ?? sumarDias(destinoInicial, -1))
  }, [abierto, destinoInicial, origenInicial])

  useEffect(() => {
    if (!abierto) return
    const ac = new AbortController()
    setCargando(true)
    setFallo(null)
    api
      .resumen(desde, ac.signal)
      .then((r) => {
        setDia(r)
        // Por defecto, todo el día marcado: el caso más habitual es «repetir lo de ayer».
        setElegidas(new Set(TIPOS_COMIDA.flatMap((t) => (r.comidas[t] ?? []).map((c) => c.id))))
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted) return
        setDia(null)
        setFallo(e instanceof Error ? e.message : 'No se pudo cargar ese día.')
      })
      .finally(() => !ac.signal.aborted && setCargando(false))
    return () => ac.abort()
  }, [abierto, desde])

  const todas = useMemo(() => (dia ? TIPOS_COMIDA.flatMap((t) => dia.comidas[t] ?? []) : []), [dia])
  const seleccion = todas.filter((c) => elegidas.has(c.id))
  const kcal = seleccion.reduce((s, c) => s + c.calorias, 0)
  const todoMarcado = todas.length > 0 && seleccion.length === todas.length

  const alternar = (ids: string[], marcar: boolean) =>
    setElegidas((prev) => {
      const n = new Set(prev)
      for (const id of ids) (marcar ? n.add(id) : n.delete(id))
      return n
    })

  async function copiar() {
    if (!seleccion.length) return
    setCopiando(true)
    setFallo(null)
    try {
      const r = await api.copiarComidas({ desde, hasta, ...(todoMarcado ? {} : { ids: seleccion.map((c) => c.id) }) })
      onCopiado(hasta, r.comidas)
    } catch (e) {
      setFallo(e instanceof Error ? e.message : 'No se pudieron copiar las comidas.')
    } finally {
      setCopiando(false)
    }
  }

  return (
    <Sheet
      abierto={abierto}
      onClose={onClose}
      titulo="Copiar comidas de otro día"
      descripcion="Elige el día, marca lo que quieras repetir y dónde copiarlo."
      ancho="md"
      pie={
        <Button block icon={<CopyPlus size={18} />} loading={copiando} disabled={!seleccion.length || copiando} onClick={() => void copiar()} data-testid="copiar-confirmar">
          {seleccion.length ? `Copiar ${seleccion.length} ${seleccion.length === 1 ? 'comida' : 'comidas'} · ${entero(kcal)} kcal` : 'Marca alguna comida'}
        </Button>
      }
    >
      <div className="space-y-5">
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Copiar desde</legend>
          <div className="flex flex-wrap items-center gap-2">
            {ATAJOS.map((a) => {
              const f = sumarDias(hoy, -a.dias)
              return (
                <button
                  key={a.dias}
                  type="button"
                  onClick={() => setDesde(f)}
                  aria-pressed={desde === f}
                  className={cx(
                    'rounded-full border px-3 py-1.5 text-sm transition-colors',
                    desde === f ? 'border-graphite bg-graphite text-white dark:border-white dark:bg-white dark:text-graphite' : 'border-neutral-200 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800',
                  )}
                >
                  {a.etiqueta}
                </button>
              )
            })}
            <input
              type="date"
              aria-label="Día de origen"
              value={desde}
              max={hoy}
              onChange={(e) => e.target.value && setDesde(e.target.value)}
              className="rounded-xl border border-neutral-200 bg-transparent px-3 py-1.5 text-sm dark:border-neutral-700 dark:[color-scheme:dark]"
            />
          </div>
        </fieldset>

        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800">
          {cargando ? (
            <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-800" />)}</div>
          ) : !todas.length ? (
            <p className="p-5 text-center text-sm text-neutral-500 dark:text-neutral-400">{fallo ?? `No hay comidas el ${fechaCorta(desde)}.`}</p>
          ) : (
            <>
              <button type="button" onClick={() => alternar(todas.map((c) => c.id), !todoMarcado)} className="flex w-full items-center gap-3 border-b border-neutral-200 px-4 py-3 text-left text-sm font-medium dark:border-neutral-800">
                <Casilla marcada={todoMarcado} parcial={seleccion.length > 0} />
                <span className="flex-1">Todo el día · {fechaCorta(desde)}</span>
                <span className="cifra text-neutral-500 dark:text-neutral-400">{entero(todas.reduce((s, c) => s + c.calorias, 0))} kcal</span>
              </button>
              {TIPOS_COMIDA.map((t) => {
                const lista = dia?.comidas[t] ?? []
                if (!lista.length) return null
                const n = lista.filter((c) => elegidas.has(c.id)).length
                return (
                  <div key={t} className="border-b border-neutral-100 last:border-0 dark:border-neutral-800/70">
                    <button type="button" onClick={() => alternar(lista.map((c) => c.id), n !== lista.length)} className="flex w-full items-center gap-3 px-4 pb-1 pt-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                      <Casilla marcada={n === lista.length} parcial={n > 0} />
                      {NOMBRE_TIPO[t]}
                    </button>
                    <ul>
                      {lista.map((c) => (
                        <li key={c.id}>
                          <button type="button" onClick={() => alternar([c.id], !elegidas.has(c.id))} aria-pressed={elegidas.has(c.id)} className="flex w-full items-center gap-3 px-4 py-2 pl-12 text-left text-sm hover:bg-neutral-50 dark:hover:bg-neutral-900">
                            <Casilla marcada={elegidas.has(c.id)} />
                            <span aria-hidden="true">{emojiDe(c)}</span>
                            <span className="min-w-0 flex-1 truncate">{c.descripcion}</span>
                            <span className="cifra text-neutral-500 dark:text-neutral-400">{entero(c.calorias)} kcal</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </>
          )}
        </div>

        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="font-medium">Copiar en</span>
          <input
            type="date"
            aria-label="Día de destino"
            value={hasta}
            onChange={(e) => e.target.value && setHasta(e.target.value)}
            className="rounded-xl border border-neutral-200 bg-transparent px-3 py-1.5 text-sm dark:border-neutral-700 dark:[color-scheme:dark]"
          />
        </label>
        {fallo && todas.length > 0 && <p role="alert" className="text-sm text-protein">{fallo}</p>}
      </div>
    </Sheet>
  )
}
