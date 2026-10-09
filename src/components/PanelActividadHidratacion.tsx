import { useEffect, useState } from 'react'
import { Droplet, Dumbbell, Flame, Trash2 } from 'lucide-react'
import { api } from '../lib/api.ts'
import { caloriasSesion, metaAgua, type IntensidadSesion, type TipoSesion } from '../lib/actividad.ts'
import { litros } from '../lib/formato.ts'
import { alFallarSyncAgua, anotarAgua, leerAguaLocal, mlAguaAcotado } from '../lib/syncAgua.ts'
import { useToast } from './ui/Toast.tsx'

interface Sesion {
  id: string
  tipo: string
  nombre: string | null
  minutos: number | null
  intensidad: string | null
  calorias: number
}

const CLAVE_SUMAR = 'nutrifit_sumar_quemadas'

export function PanelActividadHidratacion({
  fecha,
  inicial,
  onCambio,
  pesoKg,
  onActividad,
}: {
  fecha: string
  inicial: number
  onCambio?: (ml: number) => void
  pesoKg?: number | null
  onActividad?: (kcal: number, sumarAlDia: boolean) => void
}) {
  const toast = useToast()
  const [ml, setMl] = useState(() => leerAguaLocal(fecha) ?? inicial)
  const [manual, setManual] = useState('')
  const [pesoHistorico, setPesoHistorico] = useState<number | null>(null)
  const [tipo, setTipo] = useState<TipoSesion>('fuerza')
  const [intensidad, setIntensidad] = useState<IntensidadSesion>('media')
  const [minutos, setMinutos] = useState(30)
  const [sesiones, setSesiones] = useState<Sesion[]>([])
  const [guardando, setGuardando] = useState(false)
  const [sumar, setSumar] = useState(() => localStorage.getItem(CLAVE_SUMAR) === '1')

  useEffect(() => alFallarSyncAgua((mensaje) => toast({ tipo: 'error', mensaje })), [toast])
  useEffect(() => {
    setMl(leerAguaLocal(fecha) ?? inicial)
  }, [inicial, fecha])

  useEffect(() => {
    let vivo = true
    api
      .pesos(60)
      .then((r) => {
        if (!vivo) return
        const ultimo = [...r.registros].sort((a, b) => (a.fecha < b.fecha ? 1 : -1))[0]
        if (ultimo) setPesoHistorico(ultimo.peso)
      })
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [])

  useEffect(() => {
    let vivo = true
    api
      .entrenamientos(fecha)
      .then((r) => {
        if (vivo) setSesiones(r.entrenamientos)
      })
      .catch(() => {
        if (vivo) setSesiones([])
      })
    return () => {
      vivo = false
    }
  }, [fecha])

  const quemadas = sesiones.reduce((a, s) => a + (s.calorias || 0), 0)
  useEffect(() => {
    onActividad?.(quemadas, sumar)
  }, [quemadas, sumar, onActividad])

  const peso = pesoHistorico ?? (typeof pesoKg === 'number' && pesoKg > 0 ? pesoKg : null)
  const meta = metaAgua(peso, sesiones.map((s) => ({ tipo: s.tipo, minutos: s.minutos })))
  const tope = meta.objetivo > 0 ? meta.objetivo : 1
  const pct = Math.min(100, Math.round((ml / tope) * 100))
  const kcalPrevistas = caloriasSesion(tipo, intensidad, minutos)

  function sumarMl(delta: number) {
    const nuevo = mlAguaAcotado(ml + delta)
    if (nuevo === ml) return
    setMl(nuevo)
    anotarAgua(fecha, nuevo)
    onCambio?.(nuevo)
  }

  function anadirManual() {
    const n = Number(manual.replace(',', '.'))
    if (!Number.isFinite(n) || n === 0) return
    sumarMl(Math.round(n))
    setManual('')
  }

  async function registrar() {
    if (guardando || minutos < 1) return
    setGuardando(true)
    const nombre = tipo === 'fuerza' ? 'Fuerza' : 'Cardio'
    try {
      const res = await api.guardarEntrenamiento({
        tipo,
        nombre,
        minutos,
        duracion_min: minutos,
        intensidad,
        calorias: kcalPrevistas,
        fecha,
      })
      setSesiones((prev) => [{ id: res.id, tipo, nombre, minutos, intensidad, calorias: kcalPrevistas }, ...prev])
    } catch (e) {
      toast({ tipo: 'error', mensaje: e instanceof Error ? e.message : 'No se pudo guardar la sesión.' })
    } finally {
      setGuardando(false)
    }
  }

  async function quitar(id: string) {
    const previa = sesiones
    setSesiones((prev) => prev.filter((s) => s.id !== id))
    try {
      await api.borrarEntrenamiento(id)
    } catch (e) {
      setSesiones(previa)
      toast({ tipo: 'error', mensaje: e instanceof Error ? e.message : 'No se pudo eliminar la sesión.' })
    }
  }

  function cambiarSumar(valor: boolean) {
    setSumar(valor)
    localStorage.setItem(CLAVE_SUMAR, valor ? '1' : '0')
  }

  return (
    <div className="space-y-4">
      <section id="agua" className="tarjeta scroll-mt-6 p-5" aria-labelledby="titulo-agua">
        <div className="flex items-center justify-between gap-3">
          <h2 id="titulo-agua" className="flex items-center gap-2 font-semibold">
            <Droplet size={16} strokeWidth={2} className="text-water" /> Agua recomendada
          </h2>
          <p className="cifra text-sm text-neutral-500 dark:text-neutral-400">
            <span className="font-medium text-graphite dark:text-neutral-100">{litros(ml)}</span>
            {meta.objetivo > 0 ? ` / ${litros(meta.objetivo)}` : ''}
          </p>
        </div>
        <div
          className="mt-4 h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800"
          role="progressbar"
          aria-label="Agua bebida"
          aria-valuemin={0}
          aria-valuemax={meta.objetivo || ml}
          aria-valuenow={ml}
        >
          <div className="h-full rounded-full bg-water transition-[width] duration-500 ease-suave" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
          Base: {litros(meta.base)} + Ejercicio: +{litros(meta.ejercicio)} = Objetivo: {litros(meta.objetivo)}
        </p>
        {!peso && <p className="mt-1 text-xs text-neutral-500">Indica tu peso para calcular la base.</p>}
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[100, 250, 330, 500].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => sumarMl(d)}
              className="h-9 rounded-xl border border-neutral-200 text-xs font-medium transition hover:border-water/50 hover:bg-water/5 active:scale-[0.98] dark:border-neutral-800"
            >
              +{d} ml
            </button>
          ))}
          <button
            type="button"
            onClick={() => sumarMl(-250)}
            disabled={ml <= 0}
            className="h-9 rounded-xl border border-neutral-200 text-xs font-medium text-neutral-500 transition hover:bg-neutral-50 disabled:opacity-40 dark:border-neutral-800 dark:hover:bg-neutral-900"
          >
            −250 ml
          </button>
          <form
            className="col-span-2 flex h-9 overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800"
            onSubmit={(e) => {
              e.preventDefault()
              anadirManual()
            }}
          >
            <label className="sr-only" htmlFor="agua-manual">
              Mililitros a sumar
            </label>
            <input
              id="agua-manual"
              inputMode="numeric"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="ml"
              className="cifra w-full bg-transparent px-3 text-sm outline-none"
            />
            <button type="submit" className="px-3 text-xs font-medium text-mint-700 dark:text-mint-400">
              Sumar
            </button>
          </form>
        </div>
      </section>

      <section className="tarjeta p-5" aria-labelledby="titulo-actividad">
        <div className="flex items-center justify-between gap-3">
          <h2 id="titulo-actividad" className="flex items-center gap-2 font-semibold">
            <Dumbbell size={16} strokeWidth={2} className="text-mint-600 dark:text-mint-400" /> Actividad física
          </h2>
          <span className="inline-flex items-center gap-1 rounded-full bg-mint-50 px-2 py-0.5 text-xs font-medium text-mint-800 dark:bg-mint-950 dark:text-mint-300">
            <Flame size={12} /> ~{kcalPrevistas} kcal
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label="Tipo de sesión">
          {(['fuerza', 'cardio'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              aria-pressed={tipo === t}
              className={`h-9 rounded-xl text-sm font-medium transition ${tipo === t ? 'bg-mint text-white' : 'border border-neutral-200 text-neutral-600 dark:border-neutral-800 dark:text-neutral-300'}`}
            >
              {t === 'fuerza' ? 'Fuerza' : 'Cardio'}
            </button>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <label className="min-w-0 flex-1 text-xs text-neutral-500 dark:text-neutral-400" htmlFor="duracion-sesion">
            Duración: {minutos} min
            <input
              id="duracion-sesion"
              type="range"
              min={5}
              max={180}
              step={5}
              value={Math.min(180, Math.max(5, minutos))}
              onChange={(e) => setMinutos(Number(e.target.value))}
              className="mt-1 w-full accent-mint"
            />
          </label>
          <label className="sr-only" htmlFor="minutos-sesion">
            Minutos
          </label>
          <input
            id="minutos-sesion"
            type="number"
            min={1}
            max={600}
            value={minutos}
            onChange={(e) => setMinutos(Math.max(1, Math.min(600, Math.round(Number(e.target.value) || 1))))}
            className="cifra h-10 w-16 rounded-xl border border-neutral-200 bg-card text-center text-sm dark:border-neutral-800 dark:bg-card-dark"
          />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label="Intensidad">
          {(['baja', 'media', 'alta'] as const).map((nivel) => (
            <button
              key={nivel}
              type="button"
              onClick={() => setIntensidad(nivel)}
              aria-pressed={intensidad === nivel}
              className={`h-9 rounded-xl text-xs font-medium transition ${intensidad === nivel ? 'bg-mint text-white' : 'border border-neutral-200 text-neutral-600 dark:border-neutral-800 dark:text-neutral-300'}`}
            >
              {nivel === 'baja' ? 'Baja' : nivel === 'media' ? 'Media' : 'Alta'}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void registrar()}
          disabled={guardando}
          className="mt-3 h-10 w-full rounded-xl border border-mint/40 bg-mint/10 text-sm font-medium text-mint-800 transition hover:bg-mint/15 disabled:opacity-60 dark:text-mint-200"
        >
          {guardando ? 'Guardando…' : 'Añadir sesión al balance'}
        </button>
        <label className="mt-3 flex items-center justify-between gap-3 text-sm">
          <span>Sumar calorías quemadas a las restantes del día</span>
          <input type="checkbox" checked={sumar} onChange={(e) => cambiarSumar(e.target.checked)} className="h-4 w-4 accent-mint" />
        </label>
        {sesiones.length > 0 && (
          <ul className="mt-3 divide-y divide-neutral-100 border-t border-neutral-100 dark:divide-neutral-800 dark:border-neutral-800">
            {sesiones.map((s) => (
              <li key={s.id} className="flex items-center gap-2 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  {s.nombre || s.tipo} · {s.minutos ?? 0} min
                  {s.intensidad ? ` · ${s.intensidad}` : ''} · {s.calorias} kcal
                </span>
                <button type="button" onClick={() => void quitar(s.id)} aria-label={`Eliminar ${s.nombre || 'sesión'}`} className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-protein dark:hover:bg-neutral-800">
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
