import { lazy, Suspense, useEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import { ArrowRight, Mail, MonitorSmartphone } from 'lucide-react'
import { Logo } from './Logo.tsx'
import { Button } from './ui/Button.tsx'
import { Input } from './ui/Input.tsx'
import { useTurnstile } from '../hooks/useTurnstile.ts'
import { api, ApiError } from '../lib/api.ts'
import { esNativa } from '../lib/plataforma.ts'
import { URL_REPO } from '../lib/config.ts'
import { clicPrivacidad } from '../lib/rutas.ts'
import { guardarTokenApp } from '../lib/tokenApp.ts'
import { ESCRITORIO, useMedia } from '../hooks/useMedia.ts'
import { BloqueDescarga } from './BloqueDescarga.tsx'
import { ControlInstalar } from './ControlInstalar.tsx'
import { useIdioma } from '../hooks/useIdioma.ts'
import type { Usuario } from '../lib/tipos.ts'

// El QR solo se descarga en escritorio (chunk aparte con el codificador).
const LoginQR = lazy(() => import('./LoginQR.tsx'))

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

/** Marca G oficial (rojo, amarillo, verde y azul) para el botón de Google. */
function IconoGoogle() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

/**
 * Pide a la Function la URL de Google y sale hacia ella.
 * En producción el redirect_uri es https://nutri.trujillomingorance.com/api/auth/callback/google.
 * En localhost:8788 y 127.0.0.1:8788 el servidor usa ese origen. El log muestra el valor exacto.
 */
async function iniciarSesionGoogle(e: MouseEvent<HTMLButtonElement>) {
  e.preventDefault()
  const res = await fetch('/api/auth/google?formato=json', {
    headers: { Accept: 'application/json' },
    credentials: 'same-origin',
  })
  if (!res.ok) throw new Error('Google no está disponible.')
  const datos = (await res.json()) as { location?: string }
  const destino = new URL(datos.location ?? '')
  if (destino.origin !== 'https://accounts.google.com' || destino.pathname !== '/o/oauth2/v2/auth') {
    throw new Error('La respuesta de acceso no es de Google.')
  }
  const redirectUri = destino.searchParams.get('redirect_uri') ?? ''
  console.log('Google Auth redirect_uri:', redirectUri)
  if (!redirectUri) throw new Error('Falta redirect_uri.')
  window.location.assign(destino.toString())
}

export default function Login({ onEntrar, vinculando = false }: { onEntrar: (u: Usuario, perfilCompleto: boolean) => void; vinculando?: boolean }) {
  const escritorio = useMedia(ESCRITORIO) && !esNativa && !vinculando
  const [email, setEmail] = useState('')
  const [codigo, setCodigo] = useState('')
  const [errorCodigo, setErrorCodigo] = useState<string | null>(null)
  const [comprobando, setComprobando] = useState(false)
  const ultimoProbado = useRef('')
  const googleEnCurso = useRef(false)
  const [enviado, setEnviado] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso] = useState(leerAvisoUrl)
  const [espera, setEspera] = useState(0)
  const { contenedorRef, obtenerToken } = useTurnstile('login')
  const { t } = useIdioma()

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
      setCodigo('')
      setErrorCodigo(null)
      ultimoProbado.current = ''
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Algo ha fallado.')
    } finally {
      setCargando(false)
    }
  }

  async function entrarConCodigo(e?: FormEvent, valor = codigo) {
    e?.preventDefault()
    const limpio = valor.replace(/\D/g, '')
    if (limpio.length !== 6) {
      setErrorCodigo('El código tiene 6 cifras.')
      return
    }
    ultimoProbado.current = limpio
    setErrorCodigo(null)
    setComprobando(true)
    try {
      const token = await obtenerToken()
      const r = await api.entrarConCodigo(email.trim().toLowerCase(), limpio, token)
      if (esNativa && r.token) await guardarTokenApp(r.token)
      onEntrar(r.usuario, r.perfilCompleto)
    } catch (err) {
      setErrorCodigo(err instanceof Error ? err.message : 'No se pudo comprobar el código.')
      setComprobando(false)
    }
  }

  function cambiarCodigo(v: string) {
    const cifras = v.replace(/\D/g, '').slice(0, 6)
    setCodigo(cifras.length > 3 ? `${cifras.slice(0, 3)} ${cifras.slice(3)}` : cifras)
    if (errorCodigo) setErrorCodigo(null)
    // Al completar las 6 cifras (o pegarlas / autocompletarlas), se envía solo.
    if (cifras.length === 6 && cifras !== ultimoProbado.current && !comprobando) void entrarConCodigo(undefined, cifras)
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col px-6 pb-8 pt-[max(3rem,env(safe-area-inset-top))] lg:max-w-6xl lg:px-10">
      <div className="flex flex-1 flex-col justify-center lg:grid lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-center lg:gap-16 xl:gap-24">
      <div>
        <Logo size={56} className="text-graphite dark:text-neutral-100" />

        {vinculando && (
          <p role="status" className="mt-8 flex gap-3 rounded-2xl border border-mint/30 bg-mint-50 px-4 py-3 text-sm text-mint-900 dark:border-mint/20 dark:bg-mint-950 dark:text-mint-100">
            <MonitorSmartphone size={20} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>Para aprobar el acceso del ordenador, primero inicia sesión en este móvil. Después te pediremos que lo confirmes.</span>
          </p>
        )}

        {!enviado ? (
          <div key="form" className="animate-pop-in">
            <h1 className="mt-10 text-[2rem] font-semibold leading-tight tracking-tight">
              Tu nutrición,
              <br />
              <span className="text-mint-600 dark:text-mint-400">en equilibrio.</span>
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-neutral-500 dark:text-neutral-400">
              Entra con tu email. Te enviaremos un enlace y un código de acceso: sin contraseñas.
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
            <button
              type="button"
              onClick={(e) => {
                if (googleEnCurso.current) return
                googleEnCurso.current = true
                void iniciarSesionGoogle(e).catch((err: unknown) => {
                  googleEnCurso.current = false
                  setError(err instanceof Error ? err.message : 'No se pudo continuar con Google.')
                })
              }}
              className="mt-3 flex h-12 w-full items-center justify-center gap-3 rounded-2xl border border-neutral-200 text-[15px] font-medium transition hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
            >
              <IconoGoogle />
              <span>{t('login.google')}</span>
            </button>
            {!vinculando && <BloqueDescarga className="mt-8" />}
          </div>
        ) : (
          <div key="enviado" className="animate-pop-in" role="status">
            <div className="mt-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-mint-50 text-mint-600 dark:bg-mint-950 dark:text-mint-400">
              <Mail size={26} strokeWidth={1.75} />
            </div>
            <h1 className="mt-6 text-[2rem] font-semibold leading-tight tracking-tight">Revisa tu correo</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-neutral-500 dark:text-neutral-400">
              Hemos enviado un enlace y un código a <strong className="font-medium text-graphite dark:text-neutral-100">{email.trim().toLowerCase()}</strong>.
              Caducan en 15 minutos y solo funcionan una vez.
            </p>
            <form onSubmit={(e) => void entrarConCodigo(e)} noValidate className="mt-6 space-y-3">
              <Input
                label="Código de 6 cifras"
                hint="Escríbelo aquí si abres el correo en otro dispositivo."
                inputMode="numeric"
                autoComplete="one-time-code"
                enterKeyHint="go"
                placeholder="123 456"
                maxLength={7}
                value={codigo}
                onChange={(e) => cambiarCodigo(e.target.value)}
                error={errorCodigo ?? undefined}
                className="[&_input]:cifra [&_input]:text-center [&_input]:text-xl [&_input]:tracking-[0.3em]"
                data-autofocus
              />
              <Button type="submit" size="lg" block loading={comprobando}>
                {comprobando ? 'Comprobando…' : 'Entrar con el código'}
              </Button>
            </form>
            {esNativa && (
              <p className="mt-4 rounded-2xl bg-mint-50 px-4 py-3 text-sm text-mint-900 dark:bg-mint-950 dark:text-mint-100">
                Ábrelo <strong className="font-semibold">en este móvil</strong>: el enlace abrirá NutriFit directamente.
              </p>
            )}
            <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">¿No lo ves? Mira en spam o en promociones.</p>
            {error && (
              <p role="alert" className="mt-4 text-sm text-protein">
                {error}
              </p>
            )}
            <div ref={contenedorRef} className="mt-4 flex justify-center empty:hidden" />
            <div className="mt-6 space-y-2">
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
      {escritorio && (
        <aside className="hidden lg:block" aria-label="Entrar con el móvil">
          <Suspense fallback={<div className="tarjeta h-[30rem] animate-pulse bg-neutral-100/60 dark:bg-neutral-900/60" />}>
            <LoginQR onEntrar={onEntrar} />
          </Suspense>
        </aside>
      )}
      </div>
      <footer className="mt-10 space-y-2 text-center text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
        <nav aria-label="Enlaces" className="flex justify-center gap-4 font-medium">
          {!esNativa && (
            <ControlInstalar className="bg-transparent p-0 font-medium text-inherit hover:text-graphite dark:hover:text-white">
              Instalar la app
            </ControlInstalar>
          )}
          <a href="/privacidad" onClick={clicPrivacidad} className="hover:text-graphite dark:hover:text-white">
            Privacidad
          </a>
          <a href={URL_REPO} target="_blank" rel="noopener noreferrer" className="hover:text-graphite dark:hover:text-white">
            GitHub
          </a>
        </nav>
        <p>Protegido con Cloudflare Turnstile · Proyecto open source (MIT)</p>
      </footer>
    </main>
  )
}
