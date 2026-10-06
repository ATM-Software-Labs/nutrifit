/**
 * Buscar alimentos sin cámara:
 *  · Base local (≈ 360 alimentos habituales en España, valores por 100 g de
 *    USDA FoodData Central) — instantánea y sin red.
 *  · Productos envasados de Open Food Facts por nombre o código de barras,
 *    a través de nuestro servidor (caché y límites).
 * Se eligen gramos, se van sumando a una «cesta» y se revisa como un plato.
 */
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Barcode, Minus, Plus, Search, X } from 'lucide-react'
import { Sheet } from './ui/Sheet.tsx'
import { Button } from './ui/Button.tsx'
import { Segmented } from './ui/Segmented.tsx'
import { cx } from './ui/cx.ts'
import { api } from '../lib/api.ts'
import { buscarLocal, categorias, escalar, type Alimento } from '../lib/buscarAlimentos.ts'
import { entero } from '../lib/formato.ts'
import type { ResultadoAnalisis } from '../lib/tipos.ts'

type Fuente = 'local' | 'off'
interface EnCesta {
  clave: number
  alimento: Alimento
  gramos: number
}

let siguiente = 1

function nombrePlato(c: EnCesta[]) {
  const n = c.map((x) => x.alimento.nombre)
  const t = n.length <= 1 ? (n[0] ?? '') : `${n.slice(0, -1).join(', ')} y ${n.at(-1)}`
  return t.length > 100 ? `${t.slice(0, 97)}…` : t
}

function Detalle({ a, onAnadir }: { a: Alimento; onAnadir: (gramos: number) => void }) {
  const [gramos, setGramos] = useState(String(a.racion ?? 100))
  const g = Math.min(5000, Math.max(0, Number(gramos.replace(',', '.')) || 0))
  const m = escalar(a.por100, g)
  return (
    <div className="mt-3 rounded-2xl bg-neutral-50 p-3 dark:bg-neutral-900">
      <div className="flex items-center gap-2">
        <label className="relative w-28">
          <span className="sr-only">Gramos de {a.nombre}</span>
          <input
            autoFocus
            type="number"
            inputMode="decimal"
            min={1}
            max={5000}
            value={gramos}
            onChange={(e) => setGramos(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && g > 0) {
                e.preventDefault()
                onAnadir(g)
              }
            }}
            className="cifra h-10 w-full rounded-xl border border-neutral-200 bg-card pl-3 pr-8 text-sm focus:border-mint focus:outline-none focus:ring-4 focus:ring-mint/15 dark:border-neutral-800 dark:bg-card-dark"
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-neutral-500">g</span>
        </label>
        {a.racion && a.racion !== 100 && (
          <button type="button" onClick={() => setGramos(String(a.racion))} className="h-10 rounded-xl px-2.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800">
            Ración ({a.racion} g)
          </button>
        )}
        <button type="button" onClick={() => setGramos('100')} className="h-10 rounded-xl px-2.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800">
          100 g
        </button>
        <Button size="sm" className="ml-auto h-10" disabled={g <= 0} onClick={() => onAnadir(g)} icon={<Plus size={16} strokeWidth={2} />}>
          Añadir
        </Button>
      </div>
      <p className="cifra mt-2 flex flex-wrap gap-x-3 text-xs text-neutral-500 dark:text-neutral-400">
        <span className="font-medium text-graphite dark:text-neutral-100">{entero(m.calorias)} kcal</span>
        <span><span className="text-protein">●</span> P {entero(m.proteinas)} g</span>
        <span><span className="text-carbs">●</span> C {entero(m.carbohidratos)} g</span>
        <span><span className="text-fats">●</span> G {entero(m.grasas)} g</span>
      </p>
    </div>
  )
}

export default function BuscarAlimento({ onClose, onResultado }: { onClose: () => void; onResultado: (r: ResultadoAnalisis) => void }) {
  const [fuente, setFuente] = useState<Fuente>('local')
  const [consulta, setConsulta] = useState('')
  const [categoria, setCategoria] = useState<number | null>(null)
  const [abierto, setAbierto] = useState<string | null>(null)
  const [cesta, setCesta] = useState<EnCesta[]>([])
  const [off, setOff] = useState<{ cargando: boolean; resultados: Alimento[] | null; error: string | null }>({ cargando: false, resultados: null, error: null })
  const ctrl = useRef<AbortController | null>(null)
  const entrada = useRef<HTMLInputElement>(null)

  const locales = useMemo(() => (fuente === 'local' ? buscarLocal(consulta, categoria) : []), [fuente, consulta, categoria])
  useEffect(() => () => ctrl.current?.abort(), [])

  async function buscarOff(e?: FormEvent) {
    e?.preventDefault()
    const q = consulta.trim()
    if (q.length < 2) return
    ctrl.current?.abort()
    ctrl.current = new AbortController()
    setOff({ cargando: true, resultados: null, error: null })
    try {
      const esCodigo = /^\d{8,14}$/.test(q)
      const r = await api.off(esCodigo ? { codigo: q } : { q }, ctrl.current.signal)
      setOff({
        cargando: false,
        error: null,
        resultados: r.productos.map((p) => ({
          id: `off-${p.codigo || p.nombre}`,
          nombre: p.nombre,
          detalle: [p.marca, p.codigo].filter(Boolean).join(' · '),
          por100: p.por100,
          racion: p.racion,
          fuente: 'off',
        })),
      })
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setOff({ cargando: false, resultados: null, error: err instanceof Error ? err.message : 'No se pudo buscar.' })
    }
  }

  const lista = fuente === 'local' ? locales : (off.resultados ?? [])
  const total = cesta.reduce(
    (t, c) => {
      const m = escalar(c.alimento.por100, c.gramos)
      return { calorias: t.calorias + m.calorias, proteinas: t.proteinas + m.proteinas, carbohidratos: t.carbohidratos + m.carbohidratos, grasas: t.grasas + m.grasas }
    },
    { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 },
  )

  function revisar() {
    const ingredientes = cesta.map((c) => ({ nombre: c.alimento.nombre.slice(0, 100), gramos: Math.round(c.gramos), ...escalar(c.alimento.por100, c.gramos) }))
    const r1 = (v: number) => Math.round(v * 10) / 10
    onResultado({ nombre_plato: nombrePlato(cesta), ingredientes, calorias: Math.round(total.calorias), proteinas: r1(total.proteinas), carbohidratos: r1(total.carbohidratos), grasas: r1(total.grasas) })
  }

  const pie = cesta.length ? (
    <div>
      <ul className="max-h-32 space-y-1 overflow-y-auto text-sm" aria-label="Alimentos añadidos">
        {cesta.map((c) => (
          <li key={c.clave} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate">{c.alimento.nombre}</span>
            <span className="cifra text-xs text-neutral-500 dark:text-neutral-400">
              {entero(c.gramos)} g · {entero(escalar(c.alimento.por100, c.gramos).calorias)} kcal
            </span>
            <button type="button" aria-label={`Quitar ${c.alimento.nombre}`} onClick={() => setCesta((x) => x.filter((y) => y.clave !== c.clave))} className="rounded-full p-1 text-neutral-400 hover:bg-neutral-100 hover:text-graphite dark:hover:bg-neutral-800 dark:hover:text-white">
              <X size={14} />
            </button>
          </li>
        ))}
      </ul>
      <Button className="mt-3" size="lg" block onClick={revisar}>
        Revisar {cesta.length === 1 ? '1 alimento' : `${cesta.length} alimentos`} · {entero(total.calorias)} kcal
      </Button>
    </div>
  ) : undefined

  return (
    <Sheet abierto onClose={onClose} titulo="Buscar alimento" descripcion="Elige los alimentos y los gramos; después revisas el plato antes de guardarlo." ancho="lg" pie={pie}>
      <Segmented
        label="Dónde buscar"
        valor={fuente}
        onChange={(f) => {
          setFuente(f)
          setAbierto(null)
          entrada.current?.focus()
        }}
        opciones={[
          { valor: 'local', etiqueta: 'Alimentos' },
          { valor: 'off', etiqueta: 'Productos envasados' },
        ]}
      />
      <form onSubmit={(e) => (fuente === 'off' ? void buscarOff(e) : e.preventDefault())} className="mt-3 flex gap-2" role="search">
        <label className="relative flex-1">
          <span className="sr-only">{fuente === 'local' ? 'Buscar en la base de alimentos' : 'Nombre del producto o código de barras'}</span>
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
          <input
            ref={entrada}
            data-autofocus
            type="search"
            enterKeyHint="search"
            value={consulta}
            onChange={(e) => {
              setConsulta(e.target.value)
              setAbierto(null)
            }}
            placeholder={fuente === 'local' ? 'Pollo, arroz, yogur…' : 'Nombre o código de barras'}
            className="h-11 w-full rounded-2xl border border-neutral-200 bg-card pl-10 pr-3 text-[15px] placeholder:text-neutral-400 focus:border-mint focus:outline-none focus:ring-4 focus:ring-mint/15 dark:border-neutral-800 dark:bg-card-dark"
          />
        </label>
        {fuente === 'off' && (
          <Button type="submit" variant="outline" className="h-11" loading={off.cargando} disabled={consulta.trim().length < 2}>
            Buscar
          </Button>
        )}
      </form>

      {fuente === 'local' && (
        <div className="-mx-6 mt-3 flex gap-1.5 overflow-x-auto px-6 pb-1" aria-label="Categorías">
          {categorias.map((c, i) => (
            <button
              key={c}
              type="button"
              aria-pressed={categoria === i}
              onClick={() => setCategoria((x) => (x === i ? null : i))}
              className={cx(
                'shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition',
                categoria === i ? 'border-mint bg-mint-50 text-mint-800 dark:bg-mint-950 dark:text-mint-200' : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900',
              )}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {fuente === 'off' && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
          <Barcode size={14} aria-hidden="true" /> Datos de Open Food Facts (ODbL), aportados por la comunidad: revísalos.
        </p>
      )}
      {off.error && fuente === 'off' && (
        <p role="alert" className="mt-3 text-sm text-protein">
          {off.error}
        </p>
      )}

      <ul className="mt-3 divide-y divide-neutral-100 dark:divide-neutral-800" aria-label="Resultados" aria-busy={off.cargando || undefined}>
        {lista.map((a) => {
          const activo = abierto === a.id
          return (
            <li key={a.id} className="py-2.5">
              <button type="button" onClick={() => setAbierto(activo ? null : a.id)} aria-expanded={activo} className="flex w-full items-center gap-3 rounded-xl text-left">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium">{a.nombre}</span>
                  <span className="block truncate text-xs text-neutral-500 dark:text-neutral-400">
                    {a.detalle ? `${a.detalle} · ` : ''}
                    <span className="cifra">
                      {entero(a.por100.calorias)} kcal · P {entero(a.por100.proteinas)} · C {entero(a.por100.carbohidratos)} · G {entero(a.por100.grasas)} por 100 g
                    </span>
                  </span>
                </span>
                <span className={cx('flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition', activo ? 'bg-neutral-100 dark:bg-neutral-800' : 'bg-mint-50 text-mint-700 dark:bg-mint-950 dark:text-mint-400')}>
                  {activo ? <Minus size={16} /> : <Plus size={16} />}
                </span>
              </button>
              {activo && (
                <Detalle
                  a={a}
                  onAnadir={(gramos) => {
                    setCesta((c) => (c.length >= 30 ? c : [...c, { clave: siguiente++, alimento: a, gramos }]))
                    setAbierto(null)
                    entrada.current?.focus()
                  }}
                />
              )}
            </li>
          )
        })}
      </ul>
      {fuente === 'local' && !lista.length && <p className="py-8 text-center text-sm text-neutral-500 dark:text-neutral-400">Sin resultados. Prueba en «Productos envasados» o descríbelo con texto.</p>}
      {fuente === 'off' && off.resultados && !off.resultados.length && <p className="py-8 text-center text-sm text-neutral-500 dark:text-neutral-400">No hemos encontrado ese producto.</p>}
      {fuente === 'local' && <p className="mt-4 text-center text-2xs text-neutral-400">Valores por 100 g: USDA FoodData Central (dominio público).</p>}
    </Sheet>
  )
}
