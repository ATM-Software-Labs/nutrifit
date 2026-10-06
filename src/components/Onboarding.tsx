/**
 * Asistente de bienvenida (4 pasos): datos → actividad → objetivo → plan.
 * El cálculo es instantáneo con src/lib/macros.ts (el mismo que el backend);
 * al guardar, /api/usuarios/perfil (con Turnstile) dispara el email de bienvenida.
 */
import { useMemo, useState } from 'react'
import { ArrowLeft, Armchair, Bike, Dumbbell, Equal, Footprints, Mars, TrendingDown, TrendingUp, Venus } from 'lucide-react'
import { Logo } from './Logo.tsx'
import { Button } from './ui/Button.tsx'
import { Input } from './ui/Input.tsx'
import { Slider } from './ui/Slider.tsx'
import { OpcionTarjeta } from './ui/Segmented.tsx'
import { cx } from './ui/cx.ts'
import { BarraMacro } from './BarrasMacros.tsx'
import { useTurnstile } from '../hooks/useTurnstile.ts'
import { api, ApiError } from '../lib/api.ts'
import { calcularMacros, type NivelActividad, type Objetivo, type Sexo } from '../lib/macros.ts'
import { decimal, entero } from '../lib/formato.ts'
import type { Usuario } from '../lib/tipos.ts'

export const ACTIVIDADES: { valor: NivelActividad; titulo: string; descripcion: string; Icono: typeof Armchair }[] = [
  { valor: 'sedentario', titulo: 'Sedentario', descripcion: 'Trabajo de oficina, poco ejercicio', Icono: Armchair },
  { valor: 'ligero', titulo: 'Ligero', descripcion: 'Caminas o entrenas 1–3 días/semana', Icono: Footprints },
  { valor: 'moderado', titulo: 'Moderado', descripcion: 'Entrenas 3–5 días/semana', Icono: Bike },
  { valor: 'activo', titulo: 'Muy activo', descripcion: 'Entrenas 6–7 días o trabajo físico', Icono: Dumbbell },
]
export const OBJETIVOS_UI: { valor: Objetivo; titulo: string; descripcion: string; Icono: typeof Equal }[] = [
  { valor: 'deficit', titulo: 'Perder grasa', descripcion: 'Déficit suave de 400 kcal', Icono: TrendingDown },
  { valor: 'mantenimiento', titulo: 'Mantener', descripcion: 'Comer lo que gastas', Icono: Equal },
  { valor: 'superavit', titulo: 'Ganar músculo', descripcion: 'Superávit de 300 kcal', Icono: TrendingUp },
]

const PASOS = ['Sobre ti', 'Actividad', 'Objetivo', 'Tu plan']

export default function Onboarding({ usuario, onCompletado }: { usuario: Usuario; onCompletado: (u: Usuario) => void }) {
  const [paso, setPaso] = useState(0)
  const [sexo, setSexo] = useState<Sexo | null>(usuario.sexo)
  const [edad, setEdad] = useState(usuario.edad ?? 30)
  const [peso, setPeso] = useState(usuario.peso_kg ?? 70)
  const [altura, setAltura] = useState(usuario.altura_cm ?? 170)
  const [actividad, setActividad] = useState<NivelActividad | null>(usuario.nivel_actividad)
  const [objetivo, setObjetivo] = useState<Objetivo | null>(usuario.objetivo)
  const [nombre, setNombre] = useState(usuario.nombre ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { contenedorRef, obtenerToken } = useTurnstile('onboarding')

  const plan = useMemo(
    () => calcularMacros({ edad, sexo: sexo ?? 'hombre', peso, altura, actividad: actividad ?? 'ligero', objetivo: objetivo ?? 'mantenimiento' }),
    [edad, sexo, peso, altura, actividad, objetivo],
  )

  const puedeSeguir = [sexo !== null, actividad !== null, objetivo !== null, nombre.trim().length > 0][paso]

  async function guardar() {
    if (!sexo || !actividad || !objetivo) return
    const n = nombre.trim()
    if (!n || /[<>]/.test(n)) {
      setError('Escribe tu nombre (sin símbolos < >).')
      return
    }
    setError(null)
    setGuardando(true)
    try {
      const token = await obtenerToken()
      const r = await api.guardarPerfil({ nombre: n, edad, sexo, peso, altura, actividad, objetivo }, token)
      const { default: confetti } = await import('canvas-confetti')
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        void confetti({ particleCount: 120, spread: 75, startVelocity: 38, origin: { y: 0.65 }, colors: ['#10B981', '#34D399', '#A7F3D0', '#111827'] })
      }
      setTimeout(() => onCompletado(r.usuario), 900)
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'No se pudo guardar.')
      setGuardando(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setPaso((p) => p - 1)}
          aria-label="Paso anterior"
          className={cx(
            '-ml-2 rounded-full p-2 text-neutral-500 transition hover:bg-neutral-100 dark:hover:bg-neutral-800',
            paso === 0 && 'invisible',
          )}
        >
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <div className="flex flex-1 gap-1.5" role="progressbar" aria-label="Progreso" aria-valuemin={1} aria-valuemax={4} aria-valuenow={paso + 1} aria-valuetext={`Paso ${paso + 1} de 4: ${PASOS[paso]}`}>
          {PASOS.map((p, i) => (
            <span key={p} className="h-1 flex-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
              <span className={cx('block h-full rounded-full bg-mint transition-[width] duration-500 ease-suave', i <= paso ? 'w-full' : 'w-0')} />
            </span>
          ))}
        </div>
        <Logo size={28} className="text-graphite dark:text-neutral-100" />
      </header>

      <div key={paso} className="flex flex-1 animate-paso-in flex-col pt-8">
        <p className="etiqueta">
          Paso {paso + 1} de 4 · {PASOS[paso]}
        </p>

        {paso === 0 && (
          <>
            <h1 className="mt-2 text-[1.75rem] font-semibold leading-tight tracking-tight">Cuéntanos sobre ti</h1>
            <p className="mt-2 text-neutral-500 dark:text-neutral-400">Lo usamos para calcular tu gasto energético.</p>
            <fieldset className="mt-8">
              <legend className="sr-only">Sexo</legend>
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    { v: 'hombre', t: 'Hombre', I: Mars },
                    { v: 'mujer', t: 'Mujer', I: Venus },
                  ] as const
                ).map(({ v, t, I }) => {
                  const sel = sexo === v
                  return (
                    <label
                      key={v}
                      className={cx(
                        'flex cursor-pointer flex-col items-center gap-3 rounded-2xl border bg-card py-6 transition-all duration-200 ease-suave has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-mint/60 dark:bg-card-dark',
                        sel ? 'border-mint shadow-[0_0_0_3px_rgb(16_185_129_/_0.12)]' : 'border-neutral-200 hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700',
                      )}
                    >
                      <input type="radio" name="sexo" className="sr-only" checked={sel} onChange={() => setSexo(v)} />
                      <span
                        className={cx(
                          'flex h-14 w-14 items-center justify-center rounded-full transition-colors',
                          sel ? 'bg-mint text-white' : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400',
                        )}
                      >
                        <I size={26} strokeWidth={1.75} />
                      </span>
                      <span className="font-medium">{t}</span>
                    </label>
                  )
                })}
              </div>
            </fieldset>
            <div className="mt-10 space-y-8">
              <Slider label="Edad" value={edad} min={14} max={100} unidad="años" onChange={setEdad} />
              <Slider label="Peso" value={peso} min={35} max={200} step={0.5} unidad="kg" onChange={setPeso} formato={decimal} />
              <Slider label="Altura" value={altura} min={120} max={230} unidad="cm" onChange={setAltura} />
            </div>
          </>
        )}

        {paso === 1 && (
          <>
            <h1 className="mt-2 text-[1.75rem] font-semibold leading-tight tracking-tight">¿Cuánto te mueves?</h1>
            <p className="mt-2 text-neutral-500 dark:text-neutral-400">Piensa en una semana normal.</p>
            <div className="mt-8 space-y-3" role="radiogroup" aria-label="Nivel de actividad">
              {ACTIVIDADES.map(({ valor, titulo, descripcion, Icono }) => (
                <OpcionTarjeta
                  key={valor}
                  nombre="actividad"
                  seleccionada={actividad === valor}
                  onSelect={() => setActividad(valor)}
                  icono={<Icono size={20} strokeWidth={1.75} />}
                  titulo={titulo}
                  descripcion={descripcion}
                />
              ))}
            </div>
          </>
        )}

        {paso === 2 && (
          <>
            <h1 className="mt-2 text-[1.75rem] font-semibold leading-tight tracking-tight">¿Cuál es tu objetivo?</h1>
            <p className="mt-2 text-neutral-500 dark:text-neutral-400">Podrás cambiarlo cuando quieras.</p>
            <div className="mt-8 space-y-3" role="radiogroup" aria-label="Objetivo">
              {OBJETIVOS_UI.map(({ valor, titulo, descripcion, Icono }) => (
                <OpcionTarjeta
                  key={valor}
                  nombre="objetivo"
                  seleccionada={objetivo === valor}
                  onSelect={() => setObjetivo(valor)}
                  icono={<Icono size={20} strokeWidth={1.75} />}
                  titulo={titulo}
                  descripcion={descripcion}
                />
              ))}
            </div>
          </>
        )}

        {paso === 3 && (
          <>
            <h1 className="mt-2 text-[1.75rem] font-semibold leading-tight tracking-tight">Tu plan diario</h1>
            <p className="mt-2 text-neutral-500 dark:text-neutral-400">Calculado con la fórmula Mifflin-St Jeor.</p>
            <div className="tarjeta mt-8 p-6">
              <div className="flex items-end justify-between">
                <div>
                  <p className="etiqueta">Calorías</p>
                  <p className="cifra mt-1 text-5xl font-semibold tracking-tight">
                    {entero(plan.calorias)}
                    <span className="ml-1.5 text-base font-normal text-neutral-500 dark:text-neutral-400">kcal</span>
                  </p>
                </div>
                <div className="pb-1.5 text-right text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  <p>
                    Basal <span className="cifra font-medium text-graphite dark:text-neutral-200">{entero(plan.tmb)}</span>
                  </p>
                  <p>
                    Gasto <span className="cifra font-medium text-graphite dark:text-neutral-200">{entero(plan.tdee)}</span>
                  </p>
                </div>
              </div>
              <div className="mt-6 space-y-4">
                <BarraMacro macro="proteinas" valor={plan.proteinas} meta={plan.proteinas} compacta />
                <BarraMacro macro="carbohidratos" valor={plan.carbohidratos} meta={plan.carbohidratos} compacta />
                <BarraMacro macro="grasas" valor={plan.grasas} meta={plan.grasas} compacta />
              </div>
              <div className="mt-6 flex h-2 overflow-hidden rounded-full" aria-hidden="true">
                <span className="bg-protein" style={{ flexGrow: plan.proteinas * 4 }} />
                <span className="bg-carbs" style={{ flexGrow: plan.carbohidratos * 4 }} />
                <span className="bg-fats" style={{ flexGrow: plan.grasas * 9 }} />
              </div>
              <p className="mt-2 flex justify-between text-2xs text-neutral-500 dark:text-neutral-400">
                <span>P {Math.round(((plan.proteinas * 4) / plan.calorias) * 100)}%</span>
                <span>C {Math.round(((plan.carbohidratos * 4) / plan.calorias) * 100)}%</span>
                <span>G {Math.round(((plan.grasas * 9) / plan.calorias) * 100)}%</span>
              </p>
            </div>
            <Input
              className="mt-6"
              label="¿Cómo te llamas?"
              placeholder="Tu nombre"
              autoComplete="given-name"
              maxLength={60}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              error={error ?? undefined}
            />
            <div ref={contenedorRef} className="mt-4 flex justify-center empty:hidden" />
          </>
        )}

        <div className="mt-auto pt-10">
          {paso < 3 ? (
            <Button size="lg" block disabled={!puedeSeguir} onClick={() => setPaso((p) => p + 1)}>
              Continuar
            </Button>
          ) : (
            <Button size="lg" block disabled={!puedeSeguir} loading={guardando} onClick={() => void guardar()}>
              {guardando ? 'Guardando…' : 'Guardar y empezar'}
            </Button>
          )}
        </div>
      </div>
    </main>
  )
}
