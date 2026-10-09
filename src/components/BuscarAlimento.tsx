/**
 * Buscar alimentos sin cámara:
 *  · Al teclear, a los 150 ms: hasta 5 sugerencias locales (USDA + historial).
 *    Sin red y sin tokens.
 *  · Enter con sugerencias elige la resaltada. Enter sin resultados, o
 *    «Estimar con IA», llama a /api/comidas/analizar-texto.
 *  · Productos envasados: Open Food Facts solo al pulsar Buscar o Enter.
 * Se eligen gramos, se van sumando a una «cesta» y se revisa como un plato.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Barcode, Minus, Plus, Search, Sparkles, X } from 'lucide-react'
import { Sheet } from './ui/Sheet.tsx'
import { Button } from './ui/Button.tsx'
import { Segmented } from './ui/Segmented.tsx'
import { cx } from './ui/cx.ts'
import { useTurnstile } from '../hooks/useTurnstile.ts'
import { api } from '../lib/api.ts'
import { recordarAliasDelAnalisis, resolverAlias, resultadoDesdeAlias } from '../lib/aliasAlimentos.ts'
import { buscarLocal, categorias, escalar, normalizar, type Alimento } from '../lib/buscarAlimentos.ts'
import { hidratarHistorial, leerHistorial, recordarAlimento } from '../lib/historialAlimentos.ts'
import { sugerir } from '../lib/sugerenciasAlimento.ts'
import { entero } from '../lib/formato.ts'
import type { ResultadoAnalisis } from '../lib/tipos.ts'

type Fuente = 'local' | 'off'
interface EnCesta {
  clave: number
  alimento: Alimento
  gramos: number
}

let siguiente = 1

/** Icono por nombre de categoría. El índice del filtro sigue el orden de `categorias`. */
const ICONO_CATEGORIA: Record<string, string> = {
  Frutas: '🍎',
  Verduras: '🥦',
  'Dulces y snacks': '🍪',
  Legumbres: '🫘',
  'Cereales y pan': '🍞',
  Lácteos: '🥛',
  'Aceites y grasas': '🫒',
  Huevos: '🥚',
  Carnes: '🥩',
  Embutidos: '🥓',
  'Pescados y mariscos': '🐟',
  'Frutos secos': '🥜',
  'Salsas y condimentos': '🧂',
  Platos: '🍲',
  Bebidas: '🥤',
  Suplementos: '💊',
}

const CHIP_BASE = 'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs transition'
const CHIP_REPOSO = 'border-zinc-200 bg-zinc-100/80 text-zinc-600 hover:bg-zinc-200/80 dark:border-zinc-700/50 dark:bg-zinc-800/60 dark:text-zinc-300 dark:hover:bg-white/[0.08]'
const CHIP_ACTIVO = 'border-emerald-500 bg-emerald-500 font-semibold text-black shadow-md shadow-emerald-500/20'

function centrarChip(el: HTMLElement) {
  const fila = el.closest<HTMLElement>('.chips-categorias')
  const suave = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
  if (!fila) {
    el.scrollIntoView({ behavior: suave, inline: 'center', block: 'nearest' })
    return
  }
  // Solo se mueve la fila: el scroll del modal no se lleva el chip.
  const destino = fila.scrollLeft + (el.getBoundingClientRect().left - fila.getBoundingClientRect().left) - (fila.clientWidth - el.offsetWidth) / 2
  fila.scrollTo({ left: destino, behavior: suave })
}

function lineaRacion(a: Alimento) {
  const g = a.racion ?? 100
  const m = escalar(a.por100, g)
  const n = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1))
  return `${entero(m.calorias)} kcal · P ${n(m.proteinas)} · C ${n(m.carbohidratos)} · G ${n(m.grasas)} · ración ${g} g`
}

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
  const [consultaDebounced, setConsultaDebounced] = useState('')
  const [historial, setHistorial] = useState(leerHistorial)
  const [abierto, setAbierto] = useState<Alimento | null>(null)
  const [ocultas, setOcultas] = useState(false)
  const [resaltado, setResaltado] = useState(0)
  const [cesta, setCesta] = useState<EnCesta[]>([])
  const [off, setOff] = useState<{ cargando: boolean; resultados: Alimento[] | null; error: string | null }>({ cargando: false, resultados: null, error: null })
  const [ia, setIa] = useState<{ cargando: boolean; error: string | null }>({ cargando: false, error: null })
  const ctrl = useRef<AbortController | null>(null)
  const entrada = useRef<HTMLInputElement>(null)
  const filaCats = useRef<HTMLDivElement>(null)
  const esperaOff = useRef<number | null>(null)
  const esperaSug = useRef<number | null>(null)
  const { contenedorRef, obtenerToken } = useTurnstile('analizar-texto', false)

  const alias = useMemo(() => resolverAlias(consulta), [consulta])
  const textoBusqueda = alias?.display_name ?? consulta
  const escribiendo = normalizar(consulta).length >= 2
  const locales = useMemo(() => {
    if (fuente === 'local') {
      if (escribiendo) return []
      return buscarLocal('', categoria, 40)
    }
    if (textoBusqueda.trim().length < 1) return []
    return buscarLocal(textoBusqueda, null, 12)
  }, [fuente, textoBusqueda, categoria, escribiendo])
  const sugerencias = useMemo(() => (fuente === 'local' ? sugerir(consultaDebounced, historial, categoria, 5) : []), [fuente, consultaDebounced, historial, categoria])
  const sugerenciasListas = fuente === 'local' && escribiendo && consultaDebounced === consulta && !ocultas

  useEffect(() => {
    if (esperaSug.current) window.clearTimeout(esperaSug.current)
    esperaSug.current = window.setTimeout(() => setConsultaDebounced(consulta), 150)
    return () => {
      if (esperaSug.current) window.clearTimeout(esperaSug.current)
    }
  }, [consulta])

  useEffect(() => {
    let vivo = true
    void hidratarHistorial().then((h) => {
      if (vivo && h) setHistorial(h)
    })
    return () => {
      vivo = false
    }
  }, [])

  useEffect(() => () => {
    ctrl.current?.abort()
    if (esperaOff.current) window.clearTimeout(esperaOff.current)
  }, [])

  // Los huecos laterales permiten centrar el primer y el último chip.
  // Al abrir, el primero queda alineado al borde para no mostrar ese hueco.
  useLayoutEffect(() => {
    const fila = filaCats.current
    if (!fila) return
    const primero = fila.querySelector('button')
    if (!primero) return
    const pad = Number.parseFloat(getComputedStyle(fila).paddingLeft) || 0
    fila.scrollLeft += primero.getBoundingClientRect().left - fila.getBoundingClientRect().left - pad
  }, [fuente])

  useEffect(() => {
    setResaltado(0)
  }, [consultaDebounced, sugerencias.length])

  function ejecutarOff(q: string) {
    ctrl.current?.abort()
    ctrl.current = new AbortController()
    setOff((s) => ({ cargando: true, resultados: s.resultados, error: null }))
    const esCodigo = /^\d{8,14}$/.test(q)
    void api
      .off(esCodigo ? { codigo: q } : { q }, ctrl.current.signal)
      .then((r) => {
        setOff({
          cargando: false,
          error: null,
          resultados: r.productos.map((p) => ({
            id: `off-${p.codigo || p.nombre}`,
            nombre: p.nombre,
            detalle: [p.marca, p.codigo].filter(Boolean).join(' · '),
            por100: p.por100,
            racion: p.racion,
            fuente: 'off' as const,
          })),
        })
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setOff({ cargando: false, resultados: null, error: err instanceof Error ? err.message : 'No se pudo buscar.' })
      })
  }

  function programarOff(esperaMs: number) {
    if (esperaOff.current) window.clearTimeout(esperaOff.current)
    const q = (alias?.display_name ?? consulta).trim()
    if (fuente !== 'off' || q.length < 2) {
      ctrl.current?.abort()
      setOff({ cargando: false, resultados: null, error: null })
      return
    }
    esperaOff.current = window.setTimeout(() => ejecutarOff(q), esperaMs)
  }

  useEffect(() => {
    if (fuente === 'off') return
    ctrl.current?.abort()
    if (esperaOff.current) window.clearTimeout(esperaOff.current)
  }, [fuente])

  function buscarOff(e?: FormEvent) {
    e?.preventDefault()
    programarOff(0)
  }

  function anotar(a: Alimento) {
    setHistorial(recordarAlimento({ nombre: a.nombre, por100: a.por100, racion: a.racion }))
  }

  function elegir(a: Alimento) {
    anotar(a)
    setAbierto(a)
    setOcultas(true)
    setIa((s) => ({ ...s, error: null }))
  }

  async function estimar() {
    if (ia.cargando) return
    const limpio = consulta.trim()
    if (limpio.length < 3) {
      setIa({ cargando: false, error: 'Escribe al menos 3 letras para estimar con IA.' })
      return
    }
    const oficial = resolverAlias(limpio)
    if (oficial) {
      setIa({ cargando: false, error: null })
      onResultado(resultadoDesdeAlias(limpio, oficial.display_name))
      return
    }
    setIa({ cargando: true, error: null })
    try {
      const token = await obtenerToken()
      const r = await api.analizarTexto(limpio, token)
      if (!r.resultado.ingredientes.length && r.resultado.calorias === 0) {
        setIa({ cargando: false, error: 'No hemos reconocido ninguna comida en el texto. Prueba a describirla de otra forma.' })
        return
      }
      recordarAliasDelAnalisis(limpio, r.resultado)
      setIa({ cargando: false, error: null })
      onResultado(r.resultado)
    } catch (err) {
      setIa({ cargando: false, error: err instanceof Error ? err.message : 'No se pudo estimar la comida.' })
    }
  }

  function confirmar(e: FormEvent) {
    e.preventDefault()
    if (fuente === 'off') {
      buscarOff()
      return
    }
    const ahora = sugerir(consulta, historial, categoria, 5)
    if (ahora.length) {
      const mismas = consulta === consultaDebounced
      const idx = mismas ? Math.min(resaltado, ahora.length - 1) : 0
      elegir(ahora[idx]!)
      return
    }
    void estimar()
  }

  function teclado(e: KeyboardEvent<HTMLInputElement>) {
    if (fuente !== 'local' || !sugerenciasListas) return
    if (e.key === 'Escape') {
      e.preventDefault()
      setOcultas(true)
      return
    }
    if (!sugerencias.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setResaltado((i) => (i + 1) % sugerencias.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setResaltado((i) => (i - 1 + sugerencias.length) % sugerencias.length)
    }
  }

  const envasados = fuente === 'off' ? (off.resultados ?? []) : []
  const lista = fuente === 'local' ? locales : [...locales, ...envasados]
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
      <form onSubmit={(e) => void confirmar(e)} className="relative mt-3 flex gap-2" role="search">
        <label className="relative flex-1">
          <span className="sr-only">{fuente === 'local' ? 'Buscar en la base de alimentos' : 'Nombre del producto o código de barras'}</span>
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
          <input
            ref={entrada}
            data-autofocus
            type="search"
            enterKeyHint="search"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={sugerenciasListas}
            aria-controls="nf-sugerencias"
            aria-activedescendant={sugerenciasListas && sugerencias[resaltado] ? `nf-sug-${resaltado}` : undefined}
            value={consulta}
            onChange={(e) => {
              setConsulta(e.target.value)
              setAbierto(null)
              setOcultas(false)
              setIa((s) => ({ ...s, error: null }))
            }}
            onKeyDown={teclado}
            placeholder={fuente === 'local' ? 'Pollo, arroz, yogur…' : 'Nombre o código de barras'}
            className="h-11 w-full rounded-2xl border border-neutral-200 bg-card pl-10 pr-3 text-[15px] placeholder:text-neutral-400 focus:border-mint focus:outline-none focus:ring-4 focus:ring-mint/15 dark:border-neutral-800 dark:bg-card-dark"
          />
        </label>
        {fuente === 'off' && (
          <Button type="submit" variant="outline" className="h-11" loading={off.cargando} disabled={consulta.trim().length < 2}>
            Buscar
          </Button>
        )}
        {sugerenciasListas && (
          <ul id="nf-sugerencias" role="listbox" aria-label="Sugerencias" className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-2xl border border-neutral-200 bg-card shadow-sheet dark:border-neutral-800 dark:bg-card-dark">
            {sugerencias.map((a, i) => (
              <li key={a.id} role="presentation">
                <button
                  type="button"
                  id={`nf-sug-${i}`}
                  role="option"
                  aria-selected={i === resaltado}
                  onMouseEnter={() => setResaltado(i)}
                  onClick={() => elegir(a)}
                  className={cx('flex w-full flex-col px-3 py-2 text-left', i === resaltado ? 'bg-mint-50 dark:bg-mint-950' : 'hover:bg-neutral-50 dark:hover:bg-neutral-900')}
                >
                  <span className="truncate text-[15px] font-medium">{a.nombre}</span>
                  <span className="cifra truncate text-xs text-neutral-500 dark:text-neutral-400">{lineaRacion(a)}</span>
                </button>
              </li>
            ))}
            {!sugerencias.length && (
              <li role="presentation">
                <button type="button" onClick={() => void estimar()} disabled={ia.cargando} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-mint-800 hover:bg-mint-50 disabled:opacity-60 dark:text-mint-200 dark:hover:bg-mint-950">
                  <Sparkles size={16} strokeWidth={1.75} aria-hidden="true" />
                  {ia.cargando ? 'Estimando…' : alias ? `Usar «${alias.display_name}»` : 'Estimar con IA'}
                </button>
              </li>
            )}
          </ul>
        )}
      </form>
      {alias && (
        <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
          Nombre oficial: <span className="font-medium text-graphite dark:text-neutral-100">{alias.display_name}</span>
        </p>
      )}

      {fuente === 'local' && (
        <div ref={filaCats} className="chips-categorias -mx-6 mt-3 flex gap-1.5 px-6 pb-1" role="group" aria-label="Categorías">
          <span aria-hidden="true" className="w-1/2 shrink-0" />
          <button
            type="button"
            aria-pressed={categoria === null}
            onClick={(e) => {
              centrarChip(e.currentTarget)
              setCategoria(null)
            }}
            className={cx(CHIP_BASE, categoria === null ? CHIP_ACTIVO : CHIP_REPOSO)}
          >
            <span aria-hidden="true">🍽️</span>
            Todas
          </button>
          {categorias.map((c, i) => (
            <button
              key={c}
              type="button"
              aria-pressed={categoria === i}
              onClick={(e) => {
                centrarChip(e.currentTarget)
                setCategoria((x) => (x === i ? null : i))
              }}
              className={cx(CHIP_BASE, categoria === i ? CHIP_ACTIVO : CHIP_REPOSO)}
            >
              <span aria-hidden="true">{ICONO_CATEGORIA[c] ?? '🍽️'}</span>
              {c}
            </button>
          ))}
          <span aria-hidden="true" className="w-1/2 shrink-0" />
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
      {ia.error && fuente === 'local' && (
        <p role="alert" className="mt-3 text-sm text-protein">
          {ia.error}
        </p>
      )}
      <div ref={contenedorRef} className="empty:hidden" />
      {fuente === 'local' && escribiendo && abierto && (
        <Detalle
          a={abierto}
          onAnadir={(gramos) => {
            anotar(abierto)
            setCesta((c) => (c.length >= 30 ? c : [...c, { clave: siguiente++, alimento: abierto, gramos }]))
            setAbierto(null)
            entrada.current?.focus()
          }}
        />
      )}

      {!(fuente === 'local' && escribiendo) && (
      <ul className="mt-3 divide-y divide-neutral-100 dark:divide-neutral-800" aria-label="Resultados" aria-busy={off.cargando || undefined}>
        {lista.map((a, i) => {
          const activo = abierto?.id === a.id
          const titulo = fuente === 'off' && i === 0 && a.fuente === 'local' ? 'En el dispositivo' : fuente === 'off' && a.fuente === 'off' && (i === 0 || lista[i - 1]?.fuente === 'local') ? 'Productos envasados' : ''
          return (
            <li key={a.id} className="py-2.5">
              {titulo && <p className="pb-1 text-2xs font-medium uppercase tracking-wide text-neutral-400">{titulo}</p>}
              <button type="button" onClick={() => setAbierto(activo ? null : a)} aria-expanded={activo} className="flex w-full items-center gap-3 rounded-xl text-left">
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
                    anotar(a)
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
      )}
      {fuente === 'local' && !escribiendo && !lista.length && <p className="py-8 text-center text-sm text-neutral-500 dark:text-neutral-400">Sin resultados. Prueba en «Productos envasados» o descríbelo con texto.</p>}
      {fuente === 'off' && off.cargando && !locales.length && !envasados.length && <p className="py-8 text-center text-sm text-neutral-500 dark:text-neutral-400">Buscando productos…</p>}
      {fuente === 'off' && off.resultados && !off.resultados.length && !locales.length && <p className="py-8 text-center text-sm text-neutral-500 dark:text-neutral-400">No hemos encontrado ese producto.</p>}
      {fuente === 'off' && off.resultados && !off.resultados.length && locales.length > 0 && <p className="py-3 text-center text-xs text-neutral-500 dark:text-neutral-400">No hay un envasado con ese nombre. Puedes usar el alimento de arriba.</p>}
      {fuente === 'local' && (
        <p className="mt-4 text-center text-2xs text-neutral-400">
          {escribiendo ? 'Sugerencias en el dispositivo, macros de la ración estándar.' : 'Valores por 100 g: USDA FoodData Central (dominio público).'}
        </p>
      )}
    </Sheet>
  )
}
