/**
 * Historial semanal / mensual: calorías frente al objetivo, macros P/C/G,
 * peso y agua en SVG, y la lista de días con sus totales (clic → ver ese día).
 */
import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { Button } from './ui/Button.tsx'
import { Segmented } from './ui/Segmented.tsx'
import { GraficaBarras, GraficaLinea } from './Graficas.tsx'
import { api } from '../lib/api.ts'
import { META_AGUA_ML } from '../lib/config.ts'
import { decimal, entero, litros } from '../lib/formato.ts'
import { fechaLarga, hoyISO } from '../lib/fechas.ts'
import { moverPeriodo, periodo, type TipoPeriodo } from '../lib/periodos.ts'
import type { Historial as DatosHistorial, Usuario } from '../lib/tipos.ts'

const Exportar = lazy(() => import('./Exportar.tsx'))

export function claseCalorias(v: number, meta: number | null | undefined) {
  if (!meta) return 'fill-mint'
  const r = v / meta
  return r > 1.1 ? 'fill-fats' : r < 0.9 ? 'fill-mint-200 dark:fill-mint-900' : 'fill-mint'
}

function Kpi({ etiqueta, valor, detalle }: { etiqueta: string; valor: string; detalle?: string }) {
  return (
    <div className="tarjeta p-4">
      <p className="etiqueta">{etiqueta}</p>
      <p className="cifra mt-1.5 text-2xl font-semibold tracking-tight">{valor}</p>
      {detalle && <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{detalle}</p>}
    </div>
  )
}

function Panel({ titulo, children, leyenda }: { titulo: string; children: ReactNode; leyenda?: ReactNode }) {
  return (
    <section className="tarjeta p-5" aria-label={titulo}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">{titulo}</h2>
        {leyenda}
      </div>
      {children}
    </section>
  )
}

export function Leyenda({ items }: { items: [string, string][] }) {
  return (
    <p className="flex flex-wrap gap-3 text-xs text-neutral-500 dark:text-neutral-400">
      {items.map(([clase, texto]) => (
        <span key={texto} className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${clase}`} aria-hidden="true" />
          {texto}
        </span>
      ))}
    </p>
  )
}

export default function Historial({ usuario, onVerDia }: { usuario: Usuario; onVerDia: (fecha: string) => void }) {
  const [tipo, setTipo] = useState<TipoPeriodo>('semana')
  const [ref, setRef] = useState(hoyISO)
  const [datos, setDatos] = useState<DatosHistorial | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [intento, setIntento] = useState(0)
  const [exportar, setExportar] = useState(false)
  const { desde, hasta, etiqueta } = periodo(tipo, ref)
  const hoy = hoyISO()

  useEffect(() => {
    const ctrl = new AbortController()
    setError(null)
    setDatos((d) => (d && d.desde === desde && d.hasta === hasta ? d : null))
    api
      .historial(desde, hasta, ctrl.signal)
      .then((r) => setDatos(r))
      .catch((e: unknown) => {
        if ((e as Error).name !== 'AbortError') setError(e instanceof Error ? e.message : 'No se pudo cargar el historial.')
      })
    return () => ctrl.abort()
  }, [desde, hasta, intento])

  const metas = datos?.metas ?? (usuario.meta_calorias ? { calorias: usuario.meta_calorias, proteinas: usuario.meta_proteinas ?? 0, carbohidratos: usuario.meta_carbs ?? 0, grasas: usuario.meta_grasas ?? 0 } : null)
  const fechas = datos?.dias.map((d) => d.fecha) ?? []
  const diasPasados = datos?.dias.filter((d) => d.fecha <= hoy) ?? []

  return (
    <main className="px-5 pb-8 lg:px-10 lg:pt-8">
      <div className="flex flex-col gap-4 pb-5 pt-3 lg:flex-row lg:items-end lg:justify-between lg:pt-0">
        <div>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Tu progreso</p>
          <h1 className="text-2xl font-semibold tracking-tight">Historial</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            className="w-full sm:w-52"
            label="Periodo"
            valor={tipo}
            onChange={setTipo}
            opciones={[
              { valor: 'semana', etiqueta: 'Semana' },
              { valor: 'mes', etiqueta: 'Mes' },
            ]}
          />
          <div className="flex flex-1 items-center gap-1 sm:flex-none">
            <Button variant="ghost" size="icon" aria-label={tipo === 'semana' ? 'Semana anterior' : 'Mes anterior'} onClick={() => setRef((r) => moverPeriodo(tipo, r, -1))}>
              <ChevronLeft size={18} />
            </Button>
            <p className="cifra min-w-[11rem] flex-1 text-center text-sm font-medium" aria-live="polite">
              {etiqueta}
            </p>
            <Button variant="ghost" size="icon" aria-label={tipo === 'semana' ? 'Semana siguiente' : 'Mes siguiente'} disabled={hasta >= hoy} onClick={() => setRef((r) => moverPeriodo(tipo, r, 1))}>
              <ChevronRight size={18} />
            </Button>
          </div>
          <Button variant="outline" size="sm" className="h-10" icon={<Download size={16} strokeWidth={1.75} />} onClick={() => setExportar(true)}>
            Exportar
          </Button>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-4 flex items-center justify-between rounded-2xl border border-neutral-200 p-4 text-sm dark:border-neutral-800">
          <span className="text-neutral-500">{error}</span>
          <Button size="sm" variant="outline" onClick={() => setIntento((n) => n + 1)}>
            Reintentar
          </Button>
        </div>
      )}

      {!datos && !error ? (
        <div className="grid gap-4 lg:grid-cols-2" aria-busy="true" aria-label="Cargando historial">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="tarjeta h-64 animate-pulse bg-neutral-100/60 dark:bg-neutral-900/60" />
          ))}
        </div>
      ) : datos ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi etiqueta="Media diaria" valor={datos.medias ? `${entero(datos.medias.calorias)} kcal` : '—'} detalle={metas ? `Objetivo ${entero(metas.calorias)} kcal` : undefined} />
            <Kpi etiqueta="Días en objetivo" valor={`${datos.dias_en_objetivo} / ${datos.dias_con_registro}`} detalle="±10 % de tus calorías" />
            <Kpi etiqueta="Peso" valor={datos.peso ? `${datos.peso.cambio > 0 ? '+' : ''}${decimal(datos.peso.cambio)} kg` : '—'} detalle={datos.peso ? `${decimal(datos.peso.inicio)} → ${decimal(datos.peso.fin)} kg` : 'Sin registros'} />
            <Kpi etiqueta="Agua media" valor={datos.medias?.agua_ml ? litros(datos.medias.agua_ml) : '—'} detalle={`Meta ${litros(META_AGUA_ML)} al día`} />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <Panel
              titulo="Calorías"
              leyenda={
                <Leyenda
                  items={[
                    ['bg-mint', 'En objetivo'],
                    ['bg-mint-200 dark:bg-mint-900', 'Por debajo'],
                    ['bg-fats', 'Por encima'],
                  ]}
                />
              }
            >
              <GraficaBarras
                fechas={fechas}
                titulo="Calorías por día"
                unidad="kcal"
                series={[{ nombre: 'Calorías', clase: 'fill-mint', valores: datos.dias.map((d) => d.calorias) }]}
                meta={metas?.calorias}
                claseBarra={(v) => claseCalorias(v, metas?.calorias)}
              />
            </Panel>
            <Panel
              titulo="Macros (g)"
              leyenda={
                <Leyenda
                  items={[
                    ['bg-protein', `Proteínas${datos.medias ? ` ${entero(datos.medias.proteinas)} g` : ''}`],
                    ['bg-carbs', `Carbohidratos${datos.medias ? ` ${entero(datos.medias.carbohidratos)} g` : ''}`],
                    ['bg-fats', `Grasas${datos.medias ? ` ${entero(datos.medias.grasas)} g` : ''}`],
                  ]}
                />
              }
            >
              <GraficaBarras
                fechas={fechas}
                titulo="Macros por día"
                unidad="g"
                series={[
                  { nombre: 'Proteínas', clase: 'fill-protein', valores: datos.dias.map((d) => d.proteinas) },
                  { nombre: 'Carbohidratos', clase: 'fill-carbs', valores: datos.dias.map((d) => d.carbohidratos) },
                  { nombre: 'Grasas', clase: 'fill-fats', valores: datos.dias.map((d) => d.grasas) },
                ]}
              />
            </Panel>
            <Panel titulo="Peso (kg)">
              <GraficaLinea fechas={fechas} titulo="Peso" unidad="kg" valores={datos.dias.map((d) => d.peso)} />
            </Panel>
            <Panel titulo="Agua">
              <GraficaBarras fechas={fechas} titulo="Agua por día" unidad="ml" series={[{ nombre: 'Agua', clase: 'fill-water', valores: datos.dias.map((d) => d.agua_ml) }]} meta={META_AGUA_ML} etiquetaMeta={`Meta ${litros(META_AGUA_ML)}`} />
            </Panel>
          </div>

          <section className="tarjeta mt-4 overflow-hidden" aria-labelledby="titulo-dias">
            <h2 id="titulo-dias" className="px-5 pb-2 pt-5 font-semibold">
              Días
            </h2>
            <div className="overflow-x-auto">
              <table className="cifra w-full min-w-[36rem] text-sm">
                <thead>
                  <tr className="text-left text-xs text-neutral-500 dark:text-neutral-400">
                    <th scope="col" className="px-5 py-2 font-medium">Fecha</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Calorías</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">P</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">C</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">G</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Agua</th>
                    <th scope="col" className="px-5 py-2 text-right font-medium">Peso</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {[...diasPasados].reverse().map((d) => (
                    <tr key={d.fecha} className="transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900">
                      <th scope="row" className="px-5 py-2.5 text-left font-normal">
                        <button type="button" onClick={() => onVerDia(d.fecha)} className="rounded-md text-left font-medium first-letter:uppercase hover:text-mint-700 dark:hover:text-mint-400" title="Ver este día">
                          {fechaLarga(d.fecha)}
                        </button>
                        {d.num_comidas > 0 && <span className="ml-2 text-xs text-neutral-400">{d.num_comidas === 1 ? '1 comida' : `${d.num_comidas} comidas`}</span>}
                      </th>
                      <td className="px-3 py-2.5 text-right">
                        {d.num_comidas ? (
                          <>
                            <span className="font-medium">{entero(d.calorias)}</span>
                            {metas && <span className="text-neutral-400"> / {entero(metas.calorias)}</span>}
                          </>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">{d.num_comidas ? entero(d.proteinas) : ''}</td>
                      <td className="px-3 py-2.5 text-right">{d.num_comidas ? entero(d.carbohidratos) : ''}</td>
                      <td className="px-3 py-2.5 text-right">{d.num_comidas ? entero(d.grasas) : ''}</td>
                      <td className="px-3 py-2.5 text-right">{d.agua_ml ? litros(d.agua_ml) : ''}</td>
                      <td className="px-5 py-2.5 text-right">{d.peso !== null ? `${decimal(d.peso)} kg` : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      <Suspense fallback={null}>{exportar && <Exportar usuario={usuario} desdeInicial={desde} hastaInicial={hasta > hoy ? hoy : hasta} onClose={() => setExportar(false)} />}</Suspense>
    </main>
  )
}
