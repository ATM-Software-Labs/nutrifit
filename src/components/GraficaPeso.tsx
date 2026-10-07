/** Evolución del peso (últimos 30 días) en SVG puro + registro rápido. */
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Scale } from 'lucide-react'
import { Button } from './ui/Button.tsx'
import { useToast } from './ui/Toast.tsx'
import { api } from '../lib/api.ts'
import { leerPesosLocales } from '../lib/pesoLocal.ts'
import { alFallarSyncPeso, anotarPeso } from '../lib/syncPeso.ts'
import { decimal } from '../lib/formato.ts'
import { desdeISO, fechaCorta, hoyISO } from '../lib/fechas.ts'
import type { Usuario } from '../lib/tipos.ts'

const W = 320
const H = 150
const PAD = { t: 14, r: 12, b: 22, l: 30 }
export const CLAVE_PESO_OBJETIVO = 'nf:pesoObjetivo'

export function pesoObjetivo(u: Usuario): number | null {
  const guardado = Number(localStorage.getItem(CLAVE_PESO_OBJETIVO))
  if (guardado >= 30 && guardado <= 300) return guardado
  if (!u.peso_kg) return null
  const f = u.objetivo === 'deficit' ? 0.95 : u.objetivo === 'superavit' ? 1.03 : 1
  return Math.round(u.peso_kg * f)
}

type Registro = { fecha: string; peso: number }

export default function GraficaPeso({ usuario }: { usuario: Usuario }) {
  const [registros, setRegistros] = useState<Registro[] | null>(null)
  const [valor, setValor] = useState('')
  const toast = useToast()
  const objetivo = pesoObjetivo(usuario)

  useEffect(() => alFallarSyncPeso((mensaje) => toast({ tipo: 'error', mensaje })), [toast])

  useEffect(() => {
    api
      .pesos(30)
      .then((r) => {
        const porFecha = new Map(r.registros.map((x) => [x.fecha, x]))
        const hoy = desdeISO(hoyISO()).getTime()
        for (const [fecha, peso] of Object.entries(leerPesosLocales())) {
          const dias = Math.round((hoy - desdeISO(fecha).getTime()) / 86_400_000)
          if (dias >= 0 && dias <= 30) porFecha.set(fecha, { fecha, peso })
        }
        setRegistros([...porFecha.values()].sort((a, b) => a.fecha.localeCompare(b.fecha)))
      })
      .catch(() => setRegistros([]))
  }, [])

  const g = useMemo(() => {
    if (!registros?.length) return null
    const hoy = desdeISO(hoyISO()).getTime()
    const dia = 86_400_000
    const xs = registros.map((r) => 30 - Math.round((hoy - desdeISO(r.fecha).getTime()) / dia))
    const valores = registros.map((r) => r.peso).concat(objetivo ? [objetivo] : [])
    let min = Math.floor(Math.min(...valores) - 1)
    let max = Math.ceil(Math.max(...valores) + 1)
    if (max - min < 4) {
      const c = (max + min) / 2
      min = Math.floor(c - 2)
      max = Math.ceil(c + 2)
    }
    const sx = (d: number) => PAD.l + (d / 30) * (W - PAD.l - PAD.r)
    const sy = (p: number) => PAD.t + (1 - (p - min) / (max - min)) * (H - PAD.t - PAD.b)
    const puntos = registros.map((r, i) => ({ x: sx(xs[i]!), y: sy(r.peso), ...r }))
    const linea = puntos.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
    const area = `${linea} L${puntos.at(-1)!.x.toFixed(1)} ${H - PAD.b} L${puntos[0]!.x.toFixed(1)} ${H - PAD.b} Z`
    return { puntos, linea, area, min, max, sy, yObjetivo: objetivo ? sy(objetivo) : null }
  }, [registros, objetivo])

  function guardar(e: FormEvent) {
    e.preventDefault()
    const p = Math.round(Number(valor.replace(',', '.')) * 10) / 10
    if (!(p >= 30 && p <= 300)) {
      toast({ tipo: 'error', mensaje: 'Introduce un peso entre 30 y 300 kg.' })
      return
    }
    const fecha = hoyISO()
    anotarPeso(fecha, p)
    setRegistros((rs) => [...(rs ?? []).filter((x) => x.fecha !== fecha), { fecha, peso: p }].sort((a, b) => a.fecha.localeCompare(b.fecha)))
    setValor('')
    toast({ tipo: 'exito', mensaje: 'Peso registrado' })
  }

  const ultimo = registros?.at(-1)
  const primero = registros?.[0]
  const cambio = ultimo && primero && registros!.length > 1 ? ultimo.peso - primero.peso : null

  return (
    <section id="peso" className="tarjeta scroll-mt-6 p-5" aria-labelledby="titulo-peso">
      <div className="flex items-start justify-between">
        <div>
          <h2 id="titulo-peso" className="flex items-center gap-2 font-semibold">
            <Scale size={16} strokeWidth={2} className="text-neutral-500 dark:text-neutral-400" /> Peso
          </h2>
          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">Últimos 30 días</p>
        </div>
        {ultimo && (
          <div className="text-right">
            <p className="cifra text-2xl font-semibold tracking-tight">
              {decimal(ultimo.peso)}
              <span className="ml-0.5 text-sm font-normal text-neutral-500 dark:text-neutral-400">kg</span>
            </p>
            {cambio !== null && (
              <p className={`cifra text-xs ${cambio <= 0 ? 'text-mint-700 dark:text-mint-400' : 'text-neutral-500'}`}>
                {cambio > 0 ? '+' : ''}
                {decimal(cambio)} kg
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-4">
        {registros === null ? (
          <div className="h-[150px] animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-800/60" />
        ) : g ? (
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full overflow-visible" role="img" aria-label={`Gráfica de peso: último registro ${decimal(ultimo!.peso)} kg${objetivo ? `, objetivo ${objetivo} kg` : ''}`}>
            <defs>
              <linearGradient id="nf-peso-area" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#10B981" stopOpacity="0.18" />
                <stop offset="1" stopColor="#10B981" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[g.min, (g.min + g.max) / 2, g.max].map((v) => (
              <g key={v}>
                <line x1={PAD.l} x2={W - PAD.r} y1={g.sy(v)} y2={g.sy(v)} className="stroke-neutral-100 dark:stroke-neutral-800" strokeWidth="1" />
                <text x={PAD.l - 6} y={g.sy(v) + 3} textAnchor="end" className="fill-neutral-400 text-[9px]">
                  {Math.round(v)}
                </text>
              </g>
            ))}
            {g.yObjetivo !== null && (
              <g>
                <line x1={PAD.l} x2={W - PAD.r} y1={g.yObjetivo} y2={g.yObjetivo} stroke="#10B981" strokeWidth="1.25" strokeDasharray="4 4" opacity="0.8" />
                <text x={W - PAD.r} y={g.yObjetivo - 5} textAnchor="end" className="fill-mint-600 text-[9px] font-medium dark:fill-mint-400">
                  Objetivo {objetivo} kg
                </text>
              </g>
            )}
            {g.puntos.length > 1 && <path d={g.area} fill="url(#nf-peso-area)" />}
            <path d={g.linea} fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            {g.puntos.map((p, i) => (
              <circle key={p.fecha} cx={p.x} cy={p.y} r={i === g.puntos.length - 1 ? 4 : 2.5} className={i === g.puntos.length - 1 ? 'fill-mint stroke-white dark:stroke-card-dark' : 'fill-white stroke-mint dark:fill-card-dark'} strokeWidth="2" />
            ))}
            <text x={PAD.l} y={H - 6} className="fill-neutral-400 text-[9px]">
              {fechaCorta(new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10))}
            </text>
            <text x={W - PAD.r} y={H - 6} textAnchor="end" className="fill-neutral-400 text-[9px]">
              Hoy
            </text>
          </svg>
        ) : (
          <div className="flex h-[120px] items-center justify-center rounded-xl border border-dashed border-neutral-200 text-sm text-neutral-500 dark:text-neutral-400 dark:border-neutral-800">
            Registra tu peso para ver la evolución
          </div>
        )}
      </div>

      <form onSubmit={guardar} className="mt-4 flex gap-2">
        <label className="relative flex-1">
          <span className="sr-only">Peso de hoy en kilos</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min={30}
            max={300}
            placeholder={ultimo ? decimal(ultimo.peso) : 'Peso de hoy'}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="cifra h-10 w-full rounded-xl border border-neutral-200 bg-card pl-3 pr-9 text-sm focus:border-mint focus:outline-none focus:ring-4 focus:ring-mint/15 dark:border-neutral-800 dark:bg-card-dark"
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-neutral-500 dark:text-neutral-400">kg</span>
        </label>
        <Button type="submit" size="sm" variant="outline" className="h-10" disabled={!valor}>
          Registrar
        </Button>
      </form>
    </section>
  )
}
