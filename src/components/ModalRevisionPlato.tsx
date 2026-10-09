/**
 * Revisión del plato (tras la IA) o alta manual.
 * Cada ingrediente guarda una referencia {gramos, macros}: al cambiar los
 * gramos se escala en proporción. Si la IA no dio macros por ingrediente, se
 * reparte el total estimado en proporción a los gramos originales.
 * Sin ingredientes → los totales se editan directamente.
 */
import { useMemo, useState, type FormEvent } from 'react'
import { Plus, X } from 'lucide-react'
import { Sheet } from './ui/Sheet.tsx'
import { Button } from './ui/Button.tsx'
import { Input } from './ui/Input.tsx'
import { Segmented } from './ui/Segmented.tsx'
import { entero, r1 } from '../lib/formato.ts'
import { NOMBRE_TIPO, TIPOS_COMIDA, type AlternativaPlato, type Ingrediente, type NuevaComida, type ResultadoAnalisis, type TipoComida, type Totales } from '../lib/tipos.ts'

interface Fila {
  id: number
  nombre: string
  /** Texto coloquial del usuario, si la IA lo separó de este ingrediente. */
  input_query?: string
  serving_description?: string
  minGramos?: number
  maxGramos?: number
  gramos: number
  ref: { gramos: number } & Totales
  /** Fila añadida a mano: sus macros se editan directamente. */
  manual: boolean
}

const CERO: Totales = { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 }
const CLAVES: (keyof Totales)[] = ['calorias', 'proteinas', 'carbohidratos', 'grasas']
let siguienteId = 1

function filasIniciales(r: ResultadoAnalisis | null): Fila[] {
  if (!r?.ingredientes.length) return []
  const sumaG = r.ingredientes.reduce((a, i) => a + i.gramos, 0) || 1
  return r.ingredientes.map((i) => {
    const conMacros = CLAVES.every((k) => typeof i[k] === 'number')
    const parte = i.gramos / sumaG
    const ref = {
      gramos: i.gramos,
      calorias: conMacros ? i.calorias! : r.calorias * parte,
      proteinas: conMacros ? i.proteinas! : r.proteinas * parte,
      carbohidratos: conMacros ? i.carbohidratos! : r.carbohidratos * parte,
      grasas: conMacros ? i.grasas! : r.grasas * parte,
    }
    return { id: siguienteId++, nombre: i.display_name || i.nombre, input_query: i.input_query, serving_description: i.serving_description, minGramos: i.min_gramos, maxGramos: i.max_gramos, gramos: i.gramos, ref, manual: false }
  })
}

export function macrosFila(f: Fila): Totales {
  const k = f.ref.gramos > 0 ? f.gramos / f.ref.gramos : 1
  return { calorias: f.ref.calorias * k, proteinas: f.ref.proteinas * k, carbohidratos: f.ref.carbohidratos * k, grasas: f.ref.grasas * k }
}

const num = (v: string) => {
  const n = Number(v.replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function CampoNumero({ label, valor, onChange, sufijo, ancho = 'w-20', etiquetaVisible }: { label: string; valor: number; onChange: (n: number) => void; sufijo?: string; ancho?: string; etiquetaVisible?: boolean }) {
  return (
    <label className="block">
      <span className={etiquetaVisible ? 'mb-1 block text-xs text-neutral-500' : 'sr-only'}>{label}</span>
      <span className="relative block">
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          value={Number.isFinite(valor) ? r1(valor) : 0}
          onChange={(e) => onChange(num(e.target.value))}
          onFocus={(e) => e.target.select()}
          className={`cifra h-10 ${ancho} rounded-xl border border-neutral-200 bg-card pl-3 ${sufijo ? 'pr-7' : 'pr-3'} text-right text-sm focus:border-mint focus:outline-none focus:ring-4 focus:ring-mint/15 dark:border-neutral-800 dark:bg-card-dark`}
        />
        {sufijo && <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-neutral-500 dark:text-neutral-400">{sufijo}</span>}
      </span>
    </label>
  )
}

export default function ModalRevisionPlato({
  resultado,
  imagenUrl,
  tipoInicial,
  fecha,
  onClose,
  onConfirmar,
}: {
  resultado: ResultadoAnalisis | null
  imagenUrl: string | null
  tipoInicial: TipoComida
  fecha: string
  onClose: () => void
  onConfirmar: (c: NuevaComida) => void
}) {
  const [nombre, setNombre] = useState(resultado?.display_name || resultado?.nombre_plato || '')
  const [tipo, setTipo] = useState<TipoComida>(tipoInicial)
  const [filas, setFilas] = useState<Fila[]>(() => filasIniciales(resultado))
  const [manuales, setManuales] = useState<Totales>(() =>
    resultado && !resultado.ingredientes.length
      ? { calorias: resultado.calorias, proteinas: resultado.proteinas, carbohidratos: resultado.carbohidratos, grasas: resultado.grasas }
      : CERO,
  )
  const [error, setError] = useState<string | null>(null)

  const totales = useMemo<Totales>(() => {
    if (!filas.length) return manuales
    const t = { ...CERO }
    for (const f of filas) {
      const m = macrosFila(f)
      for (const k of CLAVES) t[k] += m[k]
    }
    return t
  }, [filas, manuales])

  const cambiarFila = (id: number, cambio: Partial<Fila>) => setFilas((fs) => fs.map((f) => (f.id === id ? { ...f, ...cambio } : f)))
  const cambiarMacroManual = (f: Fila, k: keyof Totales, v: number) => {
    // Al editar macros de una fila manual, la referencia pasa a ser "estos macros para estos gramos".
    const actuales = macrosFila(f)
    cambiarFila(f.id, { ref: { ...actuales, [k]: v, gramos: f.gramos } })
  }

  function confirmar(e: FormEvent) {
    e.preventDefault()
    const desc = nombre.trim()
    if (!desc) return setError('Ponle un nombre al plato.')
    if (/[<>]/.test(desc)) return setError('El nombre no puede contener < ni >.')
    if (filas.some((f) => !f.nombre.trim() || /[<>]/.test(f.nombre))) return setError('Revisa los nombres de los ingredientes.')
    if (totales.calorias <= 0 && totales.proteinas + totales.carbohidratos + totales.grasas <= 0) return setError('Indica al menos las calorías.')
    const P = r1(totales.proteinas)
    const C = r1(totales.carbohidratos)
    const G = r1(totales.grasas)
    // Coherencia con el backend: las kcal nunca por debajo de lo que aportan los macros.
    const kcal = Math.round(Math.max(totales.calorias, (P * 4 + C * 4 + G * 9) / 1.4 - 50))
    const ingredientes: Ingrediente[] = filas.map((f) => {
      const m = macrosFila(f)
      const nombreOficial = f.nombre.trim().slice(0, 80)
      return {
        nombre: nombreOficial,
        display_name: nombreOficial,
        ...(f.input_query ? { input_query: f.input_query.slice(0, 200) } : {}),
        ...(f.serving_description ? { serving_description: f.serving_description.slice(0, 80) } : {}),
        ...(f.minGramos !== undefined ? { min_gramos: r1(f.minGramos) } : {}),
        ...(f.maxGramos !== undefined ? { max_gramos: r1(f.maxGramos) } : {}),
        gramos: r1(f.gramos),
        calorias: r1(m.calorias),
        proteinas: r1(m.proteinas),
        carbohidratos: r1(m.carbohidratos),
        grasas: r1(m.grasas),
      }
    })
    onConfirmar({ tipo_comida: tipo, descripcion: desc.slice(0, 200), calorias: kcal, proteinas: P, carbohidratos: C, grasas: G, ingredientes, imagen_url: imagenUrl, fecha })
  }

  function aplicarAlternativa(a: AlternativaPlato) {
    setNombre(a.nombre)
    setFilas([
      {
        id: siguienteId++,
        nombre: a.nombre,
        gramos: a.gramos,
        ref: { gramos: a.gramos, calorias: a.calorias, proteinas: a.proteinas, carbohidratos: a.carbohidratos, grasas: a.grasas },
        manual: true,
      },
    ])
  }

  return (
    <Sheet
      abierto
      onClose={onClose}
      titulo={resultado ? 'Revisa tu plato' : 'Añadir comida'}
      descripcion={resultado ? 'Ajusta los gramos: los macros se recalculan al momento.' : 'Escribe el plato y sus valores aproximados.'}
      ancho="lg"
      pie={
        <Button type="submit" form="form-revision" size="lg" block>
          Confirmar y Añadir al Diario
        </Button>
      }
    >
      <form id="form-revision" onSubmit={confirmar} noValidate className="space-y-6">
        {!!resultado?.alternativas?.length && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Alternativas probables">
            {resultado.alternativas.map((a) => (
              <button
                key={a.nombre}
                type="button"
                onClick={() => aplicarAlternativa(a)}
                className="rounded-full border border-neutral-200 px-3 py-1.5 text-sm transition hover:border-mint hover:bg-mint/10 dark:border-neutral-700"
              >
                {a.nombre}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-start gap-4">
          {imagenUrl && <img src={imagenUrl} alt="" className="h-20 w-20 shrink-0 rounded-2xl object-cover" />}
          <Input
            className="flex-1"
            label="Nombre del plato"
            value={nombre}
            maxLength={200}
            placeholder="p. ej. Ensalada de pollo"
            onChange={(e) => setNombre(e.target.value)}
            data-autofocus={!resultado || undefined}
          />
        </div>
        {resultado?.input_query && resultado.input_query !== nombre && (
          <p className="-mt-4 text-xs text-neutral-500 dark:text-neutral-400">Texto original: {resultado.input_query}</p>
        )}
        {resultado?.descripcion && filas.length <= 1 && resultado.descripcion !== nombre && (
          <p className="-mt-4 text-xs text-neutral-500 dark:text-neutral-400">{resultado.descripcion}</p>
        )}

        <Segmented label="Tipo de comida" valor={tipo} onChange={setTipo} opciones={TIPOS_COMIDA.map((t) => ({ valor: t, etiqueta: NOMBRE_TIPO[t] }))} />

        {/* Totales */}
        <div className="grid grid-cols-4 gap-2 rounded-2xl bg-neutral-50 p-4 dark:bg-neutral-900/60">
          {(
            [
              ['calorias', 'kcal', 'text-graphite dark:text-white'],
              ['proteinas', 'Prot.', 'text-protein'],
              ['carbohidratos', 'Carbs', 'text-carbs'],
              ['grasas', 'Grasas', 'text-fats'],
            ] as const
          ).map(([k, et, color]) => (
            <div key={k} className="text-center">
              {filas.length ? (
                <p className={`cifra text-xl font-semibold ${color}`} aria-live="polite">
                  {entero(totales[k])}
                  {k !== 'calorias' && <span className="text-xs font-normal">g</span>}
                </p>
              ) : (
                <CampoNumero label={et} valor={manuales[k]} onChange={(v) => setManuales((m) => ({ ...m, [k]: v }))} ancho="w-full" />
              )}
              <p className="mt-1 text-2xs uppercase tracking-wider text-neutral-500">{et}</p>
            </div>
          ))}
        </div>

        {/* Ingredientes */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="etiqueta">Ingredientes</h3>
            {!!filas.length && <span className="text-xs text-neutral-500 dark:text-neutral-400">{filas.length}</span>}
          </div>
          {filas.length > 0 && (
            <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {filas.map((f) => {
                const m = macrosFila(f)
                return (
                  <li key={f.id} className="py-3">
                    <div className="flex items-center gap-2">
                      <input
                        aria-label="Nombre del ingrediente"
                        value={f.nombre}
                        maxLength={80}
                        placeholder="Ingrediente"
                        onChange={(e) => cambiarFila(f.id, { nombre: e.target.value })}
                        className="h-10 min-w-0 flex-1 rounded-xl border border-transparent bg-transparent px-2 text-[15px] font-medium hover:border-neutral-200 focus:border-mint focus:outline-none focus:ring-4 focus:ring-mint/15 dark:hover:border-neutral-800"
                      />
                      <CampoNumero label={`Gramos de ${f.nombre || 'ingrediente'}`} valor={f.gramos} onChange={(g) => cambiarFila(f.id, { gramos: g })} sufijo="g" />
                      <button
                        type="button"
                        onClick={() => setFilas((fs) => fs.filter((x) => x.id !== f.id))}
                        aria-label={`Quitar ${f.nombre || 'ingrediente'}`}
                        className="rounded-full p-1.5 text-neutral-300 hover:bg-neutral-100 hover:text-protein dark:text-neutral-600 dark:hover:bg-neutral-800"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    {f.input_query && f.input_query !== f.nombre && <p className="pl-2 text-xs text-neutral-500 dark:text-neutral-400">Texto original: {f.input_query}</p>}
                    {f.serving_description && <p className="pl-2 text-xs text-neutral-500 dark:text-neutral-400">{f.serving_description}</p>}
                    {f.minGramos !== undefined && f.maxGramos !== undefined && (
                      <p className="pl-2 text-xs text-neutral-500 dark:text-neutral-400">Rango visual: {entero(f.minGramos)}–{entero(f.maxGramos)} g</p>
                    )}
                    {f.manual ? (
                      <div className="mt-2 grid grid-cols-4 gap-2 pl-2 pr-9">
                        {CLAVES.map((k) => (
                          <CampoNumero key={k} etiquetaVisible label={{ calorias: 'kcal', proteinas: 'P (g)', carbohidratos: 'C (g)', grasas: 'G (g)' }[k]} valor={m[k]} onChange={(v) => cambiarMacroManual(f, k, v)} ancho="w-full" />
                        ))}
                      </div>
                    ) : (
                      <p className="cifra mt-1 pl-2 text-xs text-neutral-500 dark:text-neutral-400">
                        {entero(m.calorias)} kcal · P {entero(m.proteinas)} · C {entero(m.carbohidratos)} · G {entero(m.grasas)}
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          <button
            type="button"
            onClick={() => {
              // Si es la primera fila y había totales manuales, se convierten en el primer ingrediente.
              const base = !filas.length && totales.calorias > 0 ? totales : CERO
              setFilas((fs) => [...fs, { id: siguienteId++, nombre: '', gramos: 100, ref: { gramos: 100, ...base }, manual: true }])
            }}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-neutral-300 py-3 text-sm font-medium text-neutral-500 transition hover:border-mint hover:text-mint-600 dark:border-neutral-700 dark:text-neutral-400"
          >
            <Plus size={16} /> Añadir ingrediente
          </button>
        </div>

        {error && (
          <p role="alert" className="text-sm text-protein">
            {error}
          </p>
        )}
      </form>
    </Sheet>
  )
}
