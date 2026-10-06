import { useEffect, useState } from 'react'
import confetti from 'canvas-confetti'
import { Moon, Sparkles, Sun } from 'lucide-react'
import { Logo } from './components/Logo.tsx'
import { useTheme } from './hooks/useTheme.ts'
import { getHealth } from './lib/api.ts'
import { MACRO_LABELS, type MacroKey } from './lib/macros.ts'

const MACRO_COLORS: Record<MacroKey, string> = {
  protein: 'bg-protein',
  carbs: 'bg-carbs',
  fats: 'bg-fats',
}

export default function App() {
  const { theme, toggle } = useTheme()
  const [api, setApi] = useState<'checking' | 'ok' | 'offline'>('checking')

  useEffect(() => {
    const ctrl = new AbortController()
    getHealth(ctrl.signal)
      .then((h) => setApi(h.ok ? 'ok' : 'offline'))
      .catch(() => setApi('offline'))
    return () => ctrl.abort()
  }, [])

  const celebrate = () =>
    confetti({ particleCount: 90, spread: 70, origin: { y: 0.7 }, colors: ['#10B981', '#34D399', '#A7F3D0'] })

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-6 pb-10 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between">
        <Logo size={36} withWordmark className="text-graphite dark:text-zinc-100" />
        <button
          type="button"
          onClick={toggle}
          aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          className="rounded-full p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-graphite dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          {theme === 'dark' ? <Sun size={20} strokeWidth={2} /> : <Moon size={20} strokeWidth={2} />}
        </button>
      </header>

      <section className="mt-16 flex flex-col items-center text-center">
        <Logo size={112} className="text-graphite dark:text-zinc-100" />
        <h1 className="mt-8 text-3xl font-semibold tracking-tight">Tu nutrición, en equilibrio.</h1>
        <p className="mt-3 text-zinc-500 dark:text-zinc-400">
          Esqueleto inicial de NutriFit. Aquí vivirá el registro de comidas y macros.
        </p>
      </section>

      <section className="mt-10 grid grid-cols-3 gap-3">
        {(Object.keys(MACRO_LABELS) as MacroKey[]).map((k) => (
          <div
            key={k}
            className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-zinc-200/70 dark:bg-card-dark dark:ring-zinc-800"
          >
            <span className={`block h-1.5 w-6 rounded-full ${MACRO_COLORS[k]}`} />
            <span className="mt-3 block text-xs text-zinc-500 dark:text-zinc-400">{MACRO_LABELS[k]}</span>
            <span className="mt-1 block text-lg font-semibold">— g</span>
          </div>
        ))}
      </section>

      <button
        type="button"
        onClick={celebrate}
        className="mt-8 inline-flex items-center justify-center gap-2 rounded-2xl bg-mint px-5 py-3 font-medium text-white shadow-sm transition hover:bg-mint-600 active:scale-[0.98]"
      >
        <Sparkles size={18} strokeWidth={2} /> Probar confeti
      </button>

      <footer className="mt-auto pt-12 text-center text-xs text-zinc-400">
        API:{' '}
        <span className={api === 'ok' ? 'text-mint' : api === 'offline' ? 'text-zinc-500' : ''}>
          {api === 'checking' ? 'comprobando…' : api === 'ok' ? 'conectada' : 'sin conexión (usa npm run pages:dev)'}
        </span>
      </footer>
    </main>
  )
}
