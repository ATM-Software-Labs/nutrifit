/**
 * Gráficas SVG ligeras para el historial y el informe (sin librerías).
 * Ancho fluido (viewBox), etiquetas en el eje X espaciadas según nº de días,
 * <title> por barra para el tooltip nativo y aria-label con el resumen.
 */
import { decimal, entero } from '../lib/formato.ts'
import { desdeISO, INICIAL_DIA } from '../lib/fechas.ts'

const W = 400
const PAD = { t: 16, r: 6, b: 20, l: 34 }

export interface Serie {
  nombre: string
  clase: string // clase de relleno/trazo de Tailwind (fill-… / stroke-…)
  valores: number[]
}

function etiquetaX(fecha: string, n: number) {
  const d = desdeISO(fecha)
  return n <= 7 ? INICIAL_DIA[(d.getDay() + 6) % 7]! : String(d.getDate())
}

function escalaY(max: number) {
  // Máximo "redondo" para 3 líneas guía.
  const paso = Math.pow(10, Math.floor(Math.log10(Math.max(1, max))))
  const tope = Math.ceil(max / paso) * paso || 1
  return tope
}

function EjeX({ fechas, x, ancho, alto }: { fechas: string[]; x: (i: number) => number; ancho: number; alto: number }) {
  const cada = fechas.length <= 7 ? 1 : fechas.length <= 16 ? 2 : 5
  return (
    <>
      {fechas.map((f, i) =>
        i % cada === 0 || (fechas.length > 7 && i === fechas.length - 1 && (fechas.length - 1) % cada > 1) ? (
          <text key={f} x={x(i) + ancho / 2} y={alto - 6} textAnchor="middle" className="fill-neutral-400 text-[10px]">
            {etiquetaX(f, fechas.length)}
          </text>
        ) : null,
      )}
    </>
  )
}

function Guias({ tope, sy, formato }: { tope: number; sy: (v: number) => number; formato: (v: number) => string }) {
  return (
    <>
      {[0, tope / 2, tope].map((v) => (
        <g key={v}>
          <line x1={PAD.l} x2={W - PAD.r} y1={sy(v)} y2={sy(v)} className="stroke-neutral-100 dark:stroke-neutral-800" strokeWidth="1" />
          <text x={PAD.l - 6} y={sy(v) + 3} textAnchor="end" className="fill-neutral-400 text-[10px]">
            {formato(v)}
          </text>
        </g>
      ))}
    </>
  )
}

/** Barras (apiladas si hay varias series) con línea de objetivo opcional. */
export function GraficaBarras({
  fechas,
  series,
  meta,
  etiquetaMeta,
  alto = 170,
  unidad,
  titulo,
  claseBarra,
}: {
  fechas: string[]
  series: Serie[]
  meta?: number | null
  etiquetaMeta?: string
  alto?: number
  unidad: string
  titulo: string
  /** Clase por barra (p. ej. según si está en objetivo); solo con una serie. */
  claseBarra?: (v: number, i: number) => string
}) {
  const n = fechas.length
  const totales = fechas.map((_, i) => series.reduce((a, s) => a + (s.valores[i] ?? 0), 0))
  const tope = escalaY(Math.max(...totales, meta ?? 0) * 1.08)
  const sy = (v: number) => PAD.t + (1 - v / tope) * (alto - PAD.t - PAD.b)
  const hueco = (W - PAD.l - PAD.r) / n
  const ancho = Math.max(2, hueco * (n <= 7 ? 0.5 : 0.7))
  const x = (i: number) => PAD.l + i * hueco + (hueco - ancho) / 2
  const conDatos = totales.filter((v) => v > 0)
  const media = conDatos.length ? conDatos.reduce((a, b) => a + b, 0) / conDatos.length : 0
  return (
    <svg viewBox={`0 0 ${W} ${alto}`} className="h-auto w-full overflow-visible" role="img" aria-label={`${titulo}: media ${entero(media)} ${unidad} en ${conDatos.length} días con datos${meta ? `, objetivo ${entero(meta)} ${unidad}` : ''}`}>
      <Guias tope={tope} sy={sy} formato={(v) => (v >= 1000 && unidad === 'ml' ? `${decimal(v / 1000)} L` : entero(v))} />
      {fechas.map((f, i) => {
        let acumulado = 0
        return (
          <g key={f}>
            <title>{`${f}: ${series.map((s) => `${s.nombre} ${entero(s.valores[i] ?? 0)}`).join(' · ')} ${unidad}`}</title>
            {series.map((s) => {
              const v = s.valores[i] ?? 0
              if (v <= 0) return null
              const yBase = sy(acumulado)
              acumulado += v
              const yTop = sy(acumulado)
              return (
                <rect
                  key={s.nombre}
                  x={x(i)}
                  y={yTop}
                  width={ancho}
                  height={Math.max(0.5, yBase - yTop)}
                  rx={series.length === 1 ? Math.min(4, ancho / 2) : 0}
                  className={series.length === 1 && claseBarra ? claseBarra(v, i) : s.clase}
                />
              )
            })}
          </g>
        )
      })}
      {meta ? (
        <g>
          <line x1={PAD.l} x2={W - PAD.r} y1={sy(meta)} y2={sy(meta)} className="stroke-mint-600 dark:stroke-mint-400" strokeWidth="1.25" strokeDasharray="5 4" />
          <text x={W - PAD.r} y={sy(meta) - 5} textAnchor="end" paintOrder="stroke" strokeWidth="4" strokeLinejoin="round" className="fill-mint-700 stroke-card text-[10px] font-medium dark:fill-mint-400 dark:stroke-card-dark">
            {etiquetaMeta ?? `Objetivo ${entero(meta)} ${unidad}`}
          </text>
        </g>
      ) : null}
      <EjeX fechas={fechas} x={x} ancho={ancho} alto={alto} />
    </svg>
  )
}

/** Línea con puntos (huecos donde no hay dato, unidos con trazo discontinuo). */
export function GraficaLinea({ fechas, valores, alto = 170, unidad, titulo }: { fechas: string[]; valores: (number | null)[]; alto?: number; unidad: string; titulo: string }) {
  const n = fechas.length
  const puntos = valores.map((v, i) => (v === null ? null : { i, v })).filter((p): p is { i: number; v: number } => p !== null)
  if (!puntos.length) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-dashed border-neutral-200 text-sm text-neutral-500 dark:border-neutral-800 dark:text-neutral-400" style={{ height: alto * 0.6 }}>
        Sin registros de peso en este periodo
      </div>
    )
  }
  const vs = puntos.map((p) => p.v)
  let min = Math.floor(Math.min(...vs) - 1)
  let max = Math.ceil(Math.max(...vs) + 1)
  if (max - min < 4) {
    const c = (max + min) / 2
    min = Math.floor(c - 2)
    max = Math.ceil(c + 2)
  }
  const hueco = (W - PAD.l - PAD.r) / n
  const sx = (i: number) => PAD.l + i * hueco + hueco / 2
  const sy = (v: number) => PAD.t + (1 - (v - min) / (max - min)) * (alto - PAD.t - PAD.b)
  const d = puntos.map((p, k) => `${k ? 'L' : 'M'}${sx(p.i).toFixed(1)} ${sy(p.v).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${alto}`} className="h-auto w-full overflow-visible" role="img" aria-label={`${titulo}: de ${decimal(vs[0]!)} a ${decimal(vs.at(-1)!)} ${unidad}`}>
      {[min, (min + max) / 2, max].map((v) => (
        <g key={v}>
          <line x1={PAD.l} x2={W - PAD.r} y1={sy(v)} y2={sy(v)} className="stroke-neutral-100 dark:stroke-neutral-800" strokeWidth="1" />
          <text x={PAD.l - 6} y={sy(v) + 3} textAnchor="end" className="fill-neutral-400 text-[10px]">
            {decimal(v)}
          </text>
        </g>
      ))}
      <path d={d} fill="none" className="stroke-mint" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {puntos.map((p) => (
        <circle key={p.i} cx={sx(p.i)} cy={sy(p.v)} r={3} className="fill-white stroke-mint dark:fill-card-dark" strokeWidth="2">
          <title>{`${fechas[p.i]}: ${decimal(p.v)} ${unidad}`}</title>
        </circle>
      ))}
      <EjeX fechas={fechas} x={(i) => sx(i) - 0.5} ancho={1} alto={alto} />
    </svg>
  )
}
