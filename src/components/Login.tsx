import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, Mail } from 'lucide-react'
import { Logo } from './Logo.tsx'
import { Button } from './ui/Button.tsx'
import { Input } from './ui/Input.tsx'
import { useTurnstile } from '../hooks/useTurnstile.ts'
import { api, ApiError } from '../lib/api.ts'

const AVISOS: Record<string, string> = {
  usado: 'Ese enlace ya se ha usado. Pide uno nuevo para entrar.',
  invalido: 'El enlace no es válido. Pide uno nuevo.',
  caducado: 'El enlace ha caducado (dura 15 minutos). Pide uno nuevo.',
  expirado: 'El enlace ha caducado (dura 15 minutos). Pide uno nuevo.',
  limite: 'Demasiados intentos. Espera unos minutos.',
  error: 'No hemos podido iniciar sesión. Inténtalo de nuevo.',
}

/** Lee y limpia ?auth=… de la URL (lo pone /api/auth/verificar al redirigir). */
function leerAvisoUrl(): string | null {
  const url = new URL(window.location.href)
  const motivo = url.searchParams.get('auth')
  if (!motivo) return null
  url.searchParams.delete('auth')
  history.replaceState(null, '', url.pathname + url.search + url.hash)
  return AVISOS[motivo] ?? AVISOS.error!
}

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export default function Login() {
  const [email, setEmail] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso] = useState(leerAvisoUrl)
  const [espera, setEspera] = useState(0)
  const { contenedorRef, obtenerToken } = useTurnstile('login')

  useEffect(() => {
    if (espera <= 0) return
    const t = setTimeout(() => setEspera((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [espera])

  async function enviar(e?: FormEvent) {
    e?.preventDefault()
    const limpio = email.trim().toLowerCase()
    if (!EMAIL_OK.test(limpio)) {
      setError('Introduce un email válido.')
      return
    }
    setError(null)
    setCargando(true)
    try {
      const token = await obtenerToken()
      await api.solicitarEnlace(limpio, token)
      setEnviado(true)
      setEspera(30)
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Algo ha fallado.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col px-6 pb-8 pt-[max(3rem,env(safe-area-inset-top))]">
      <div className="flex flex-1 flex-col justify-center">
        <Logo size={56} className="text-graphite dark:text-neutral-100" />

        {!enviado ? (
          <div key="form" className="animate-pop-in">
            <h1 className="mt-10 text-[2rem] font-semibold leading-tight tracking-tight">
              Tu nutrición,
              <br />
              <span className="text-mint-600 dark:text-mint-400">en equilibrio.</span>
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-neutral-500 dark:text-neutral-400">
              Entra con tu email. Te enviaremos un enlace de acceso: sin contraseñas.
            </p>

            {aviso && (
              <p role="alert" className="mt-6 rounded-2xl border border-fats/30 bg-fats-soft/60 px-4 py-3 text-sm text-amber-900 dark:border-fats/20 dark:bg-fats/10 dark:text-amber-200">
                {aviso}
              </p>
            )}

            <form onSubmit={enviar} noValidate className="mt-8 space-y-4">
              <Input
                label="Email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={error ?? undefined}
                required
              />
              <div ref={contenedorRef} className="flex justify-center empty:hidden" />
              <Button type="submit" size="lg" block loading={cargando}>
                {cargando ? 'Enviando…' : 'Recibir enlace de acceso'}
                {!cargando && <ArrowRight size={18} strokeWidth={2} />}
              </Button>
            </form>
          </div>
        ) : (
          <div key="enviado" className="animate-pop-in" role="status">
            <div className="mt-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-mint-50 text-mint-600 dark:bg-mint-950 dark:text-mint-400">
              <Mail size={26} strokeWidth={1.75} />
            </div>
            <h1 className="mt-6 text-[2rem] font-semibold leading-tight tracking-tight">Revisa tu correo</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-neutral-500 dark:text-neutral-400">
              Hemos enviado un enlace a <strong className="font-medium text-graphite dark:text-neutral-100">{email.trim().toLowerCase()}</strong>. Caduca
              en 15 minutos y solo funciona una vez.
            </p>
            <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">¿No lo ves? Mira en spam o en promociones.</p>
            {error && (
              <p role="alert" className="mt-4 text-sm text-protein">
                {error}
              </p>
            )}
            <div ref={contenedorRef} className="mt-4 flex justify-center empty:hidden" />
            <div className="mt-8 space-y-2">
              <Button variant="outline" size="lg" block disabled={espera > 0} loading={cargando} onClick={() => void enviar()}>
                {espera > 0 ? `Reenviar enlace (${espera} s)` : 'Reenviar enlace'}
              </Button>
              <Button
                variant="ghost"
                block
                onClick={() => {
                  setEnviado(false)
                  setError(null)
                }}
              >
                Usar otro email
              </Button>
            </div>
          </div>
        )}
      </div>
      <p className="mt-10 text-center text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
        Protegido con Cloudflare Turnstile · Proyecto open source (MIT)
      </p>
    </main>
  )
}
