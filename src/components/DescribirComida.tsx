/**
 * Añadir una comida describiéndola con palabras: la IA estima ingredientes,
 * gramos y macros (Gemini si está configurado; si no, Workers AI) y el
 * resultado pasa por la misma revisión que las fotos.
 */
import { useState, type FormEvent } from 'react'
import { Sparkles } from 'lucide-react'
import { Sheet } from './ui/Sheet.tsx'
import { Button } from './ui/Button.tsx'
import { useTurnstile } from '../hooks/useTurnstile.ts'
import { recordarAliasDelAnalisis, resolverAlias, resultadoDesdeAlias } from '../lib/aliasAlimentos.ts'
import { api } from '../lib/api.ts'
import { falloDeAnalisis, type FalloAnalisisUi } from '../lib/falloAnalisis.ts'
import { FalloAnalisis } from './FalloAnalisis.tsx'
import type { ResultadoAnalisis } from '../lib/tipos.ts'

const EJEMPLOS = ['Dos huevos revueltos y una tostada con aceite', 'Un plato de lentejas con chorizo', 'Ensalada de pasta con atún y tomate', 'Café con leche y un croissant']
const MAX = 300

export default function DescribirComida({ onClose, onResultado, onManual }: { onClose: () => void; onResultado: (r: ResultadoAnalisis) => void; onManual: () => void }) {
  const [texto, setTexto] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<FalloAnalisisUi | null>(null)
  const { contenedorRef, obtenerToken } = useTurnstile('analizar-texto')

  async function enviar(e?: FormEvent) {
    e?.preventDefault()
    const limpio = texto.trim()
    if (limpio.length < 3) {
      setError({ codigo: 'OTRO', mensaje: 'Describe un poco más lo que has comido.', reintentar: false, auto: false, manual: false, elegirOtra: false })
      return
    }
    const alias = resolverAlias(limpio)
    if (alias) {
      setError(null)
      onResultado(resultadoDesdeAlias(limpio, alias.display_name))
      return
    }
    setError(null)
    setCargando(true)
    try {
      const token = await obtenerToken()
      const r = await api.analizarTexto(limpio, token)
      if (!r.resultado.ingredientes.length && r.resultado.calorias === 0) {
        setError({ codigo: 'FOTO', mensaje: 'No hemos reconocido ninguna comida en el texto. Prueba a describirla de otra forma.', reintentar: false, auto: false, manual: false, elegirOtra: false })
        return
      }
      recordarAliasDelAnalisis(limpio, r.resultado)
      onResultado(r.resultado)
    } catch (err) {
      setError(falloDeAnalisis(err))
    } finally {
      setCargando(false)
    }
  }

  return (
    <Sheet abierto onClose={onClose} titulo="Describir con texto" descripcion="Escribe qué has comido y la cantidad si la sabes. La IA estima las calorías y los macros, y tú lo revisas." ancho="sm">
      <form onSubmit={(e) => void enviar(e)} className="space-y-4" noValidate>
        <div>
          <label htmlFor="nf-describir" className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            ¿Qué has comido?
          </label>
          <textarea
            id="nf-describir"
            data-autofocus
            rows={4}
            maxLength={MAX}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void enviar()
            }}
            placeholder="Por ejemplo: 200 g de pollo a la plancha con arroz y ensalada"
            aria-invalid={error && !error.manual && !error.reintentar ? true : undefined}
            aria-describedby="nf-describir-ayuda"
            className="w-full resize-none rounded-2xl border border-neutral-200 bg-card px-4 py-3 text-[15px] placeholder:text-neutral-400 focus:border-mint focus:outline-none focus:ring-4 focus:ring-mint/15 dark:border-neutral-800 dark:bg-card-dark dark:placeholder:text-neutral-500"
          />
          <p id="nf-describir-ayuda" className="cifra mt-1 text-right text-xs text-neutral-500 dark:text-neutral-400">
            {texto.length}/{MAX}
          </p>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Ejemplos">
          {EJEMPLOS.map((ej) => (
            <button
              key={ej}
              type="button"
              onClick={() => setTexto(ej)}
              className="rounded-full border border-neutral-200 px-3 py-1.5 text-xs text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
            >
              {ej}
            </button>
          ))}
        </div>
        {error && (
          <FalloAnalisis
            fallo={error}
            cuentaAtras={0}
            onReintentar={() => void enviar()}
            onManual={error.manual ? onManual : undefined}
          />
        )}
        <div ref={contenedorRef} className="flex justify-center empty:hidden" />
        <Button type="submit" size="lg" block loading={cargando} icon={cargando ? undefined : <Sparkles size={18} strokeWidth={1.75} />}>
          {cargando ? 'Estimando…' : 'Estimar con IA'}
        </Button>
        <p className="text-center text-xs text-neutral-500 dark:text-neutral-400">Ctrl + Intro para enviar · Es una estimación: revisa las cantidades.</p>
      </form>
    </Sheet>
  )
}
