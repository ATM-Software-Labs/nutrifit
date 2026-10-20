/** Ajustes: perfil y objetivos (recalculados al momento), tema, cuenta y enlaces. */
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { AjusteFondoBlanco } from './AjusteFondoBlanco.tsx'
import { AjusteBebidasAgua } from './AjusteBebidasAgua.tsx'
const SeccionRecordatorios = lazy(() => import('./SeccionRecordatorios.tsx'))
import { Check, ChevronRight, Download, ExternalLink, FileText, Lock, LogOut, Mail, Monitor, Moon, Shield, Sun } from 'lucide-react'
import { URL_REPO } from '../lib/config.ts'
import { clicPrivacidad, clicRecursos, navegar } from '../lib/rutas.ts'
import { esNativa } from '../lib/plataforma.ts'
import { Button } from './ui/Button.tsx'
import { Input } from './ui/Input.tsx'
import { Segmented } from './ui/Segmented.tsx'
import { useToast } from './ui/Toast.tsx'
import { ACTIVIDADES, OBJETIVOS_UI } from './Onboarding.tsx'
import { CLAVE_PESO_OBJETIVO, pesoObjetivo } from './GraficaPeso.tsx'
import { useTurnstile } from '../hooks/useTurnstile.ts'
import { useTema } from '../hooks/useTema.ts'
import { api } from '../lib/api.ts'
import { camposPerfil, hashContenido } from '../../functions/utils/contenidoHash.ts'
import { leerHashSincronizado } from '../lib/hashSync.ts'
import { calcularMacros, type NivelActividad, type Objetivo, type Sexo } from '../lib/macros.ts'
import { entero } from '../lib/formato.ts'
import type { Usuario } from '../lib/tipos.ts'
import { SeccionDispositivos } from './SeccionDispositivos.tsx'
import { EstadoServicios } from './EstadoServicios.tsx'
import { SeccionIntegraciones } from './SeccionIntegraciones.tsx'
import { SeccionPreferenciasAvanzadas } from './SeccionPreferenciasAvanzadas.tsx'
import { useIdioma } from '../hooks/useIdioma.ts'
import type { Idioma } from '../lib/i18n.ts'

const SELECT =
  'h-12 w-full appearance-none rounded-2xl border border-neutral-200 bg-card px-4 text-[15px] focus:border-mint focus:outline-none focus:ring-4 focus:ring-mint/15 dark:border-neutral-800 dark:bg-card-dark'

function Seccion({ id, titulo, children, noCard = false }: { id?: string; titulo: string; children: React.ReactNode; noCard?: boolean }) {
  return (
    <section id={id} className="space-y-3 scroll-mt-8">
      <h3 className="text-sm font-semibold tracking-wide text-neutral-500 uppercase ml-1">{titulo}</h3>
      {noCard ? children : <div className="tarjeta p-4 md:p-5 space-y-4">{children}</div>}
    </section>
  )
}

export default function Ajustes({ usuario, onClose, onUsuario, onSalir }: { usuario: Usuario; onClose: () => void; onUsuario: (u: Usuario) => void; onSalir: () => void; enPagina?: boolean }) {
  const [nombre, setNombre] = useState(usuario.nombre ?? '')
  const [sexo, setSexo] = useState<Sexo>(usuario.sexo ?? 'hombre')
  const [edad, setEdad] = useState(String(usuario.edad ?? 30))
  const [peso, setPeso] = useState(String(usuario.peso_kg ?? 70))
  const [altura, setAltura] = useState(String(usuario.altura_cm ?? 170))
  const [actividad, setActividad] = useState<NivelActividad>(usuario.nivel_actividad ?? 'ligero')
  const [objetivo, setObjetivo] = useState<Objetivo>(usuario.objetivo ?? 'mantenimiento')
  const [objetivoPeso, setObjetivoPeso] = useState(String(pesoObjetivo(usuario) ?? ''))
  const [guardando, setGuardando] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [borrando, setBorrando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { preferencia, cambiar } = useTema()
  const { idioma, t, cambiar: cambiarIdioma } = useIdioma()
  const { contenedorRef } = useTurnstile('perfil', false)
  const toast = useToast()

  const [unidades, setUnidades] = useState<'metrico' | 'imperial'>(() => {
    if (typeof window === 'undefined') return 'metrico'
    return (localStorage.getItem('nf:unidades') as 'metrico' | 'imperial') || 'metrico'
  })

  function cambiarUnidades(val: 'metrico' | 'imperial') {
    setUnidades(val)
    localStorage.setItem('nf:unidades', val)
    toast({ tipo: 'exito', mensaje: val === 'metrico' ? 'Sistema métrico activado (kg, cm, ml)' : 'Sistema imperial activado (lb, ft, oz)' })
  }

  type SeccionId = 'perfil' | 'preferencias' | 'notificaciones' | 'estrategia' | 'conexiones' | 'dispositivos' | 'legal' | 'cuenta' | 'mas' | 'peligro'

  const obtenerSeccionInicial = (): SeccionId => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.toLowerCase()
      const search = window.location.search.toLowerCase()
      if (hash.includes('recordatorio') || hash.includes('notific') || hash.includes('baja') || search.includes('notific') || search.includes('baja')) {
        return 'notificaciones'
      }
      if (hash.includes('dispositivo')) return 'dispositivos'
      if (hash.includes('legal') || hash.includes('privacid') || search.includes('legal')) return 'legal'
      if (hash.includes('cuenta')) return 'cuenta'
      if (hash.includes('preferencia')) return 'preferencias'
      if (hash.includes('estrategia')) return 'estrategia'
      if (hash.includes('conexion')) return 'conexiones'
      if (hash.includes('peligro')) return 'peligro'
    }
    return 'perfil'
  }

  const [seccionActiva, setSeccionActiva] = useState<SeccionId>(obtenerSeccionInicial)
  const [movilLista, setMovilLista] = useState(() => typeof window === 'undefined' || !window.location.hash)

  useEffect(() => {
    const alCambiarHash = () => {
      setSeccionActiva(obtenerSeccionInicial())
      if (window.location.hash) setMovilLista(false)
    }
    window.addEventListener('hashchange', alCambiarHash)
    return () => window.removeEventListener('hashchange', alCambiarHash)
  }, [])

  const [, setResumenSemanal] = useState(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('nf:pref:resumen') !== 'false'
  })
  const [, setRecordatoriosHabitos] = useState(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('nf:pref:habitos') !== 'false'
  })
  const [novedades, setNovedades] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('nf:pref:novedades') === 'true'
  })
  const [bajaComunicaciones, setBajaComunicaciones] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('nf:pref:baja') === 'true' || (window.location.hash.toLowerCase().includes('baja'))
  })

  function conmutarNovedades() {
    const sig = !novedades
    setNovedades(sig)
    localStorage.setItem('nf:pref:novedades', String(sig))
    if (sig) {
      setBajaComunicaciones(false)
      localStorage.setItem('nf:pref:baja', 'false')
    }
    toast({ tipo: 'exito', mensaje: sig ? 'Novedades activadas' : 'Novedades desactivadas' })
  }

  function darDeBajaTodas() {
    if (bajaComunicaciones) {
      setResumenSemanal(true)
      setRecordatoriosHabitos(true)
      setNovedades(false)
      setBajaComunicaciones(false)
      localStorage.setItem('nf:pref:resumen', 'true')
      localStorage.setItem('nf:pref:habitos', 'true')
      localStorage.setItem('nf:pref:novedades', 'false')
      localStorage.setItem('nf:pref:baja', 'false')
      toast({ tipo: 'exito', mensaje: 'Preferencias de comunicación restablecidas.' })
    } else {
      setResumenSemanal(false)
      setRecordatoriosHabitos(false)
      setNovedades(false)
      setBajaComunicaciones(true)
      localStorage.setItem('nf:pref:resumen', 'false')
      localStorage.setItem('nf:pref:habitos', 'false')
      localStorage.setItem('nf:pref:novedades', 'false')
      localStorage.setItem('nf:pref:baja', 'true')
      toast({ tipo: 'exito', mensaje: 'Baja completada: solo recibirás códigos de seguridad solicitados.' })
    }
  }

  const n = { edad: Number(edad), peso: Number(peso.replace(',', '.')), altura: Number(altura) }
  const valido = n.edad >= 14 && n.edad <= 100 && n.peso >= 30 && n.peso <= 300 && n.altura >= 120 && n.altura <= 230 && nombre.trim().length > 0
  const plan = useMemo(() => (valido ? calcularMacros({ ...n, sexo, actividad, objetivo }) : null), [valido, n.edad, n.peso, n.altura, sexo, actividad, objetivo]) // eslint-disable-line react-hooks/exhaustive-deps

  async function guardar() {
    if (!valido) {
      setError('Revisa los datos: edad 14–100, peso 30–300 kg, altura 120–230 cm.')
      return
    }
    setError(null)
    setGuardando(true)
    try {
      const op = Number(objetivoPeso.replace(',', '.'))
      if (op >= 30 && op <= 300) localStorage.setItem(CLAVE_PESO_OBJETIVO, String(op))
      else localStorage.removeItem(CLAVE_PESO_OBJETIVO)
      const datos = { nombre: nombre.trim(), sexo, actividad, objetivo, ...n }
      if (plan) {
        const hash = await hashContenido(camposPerfil({ ...datos, calorias: plan.calorias, proteinas: plan.proteinas, carbohidratos: plan.carbohidratos, grasas: plan.grasas }))
        if (leerHashSincronizado('perfil') === hash) {
          onClose()
          return
        }
      }
      const token = '' // con sesión no hace falta Turnstile
      const r = await api.guardarPerfil(datos, token)
      if (r.usuario) onUsuario(r.usuario)
      if (!r.sinCambios) toast({ tipo: 'exito', mensaje: 'Perfil y objetivos actualizados' })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.')
    } finally {
      setGuardando(false)
    }
  }

  async function descargarDatos() {
    setExportando(true)
    try {
      const { blob, nombre } = await api.exportarDatos()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = nombre
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
      toast({ tipo: 'exito', mensaje: 'Volcado descargado' })
    } catch (e) {
      toast({ tipo: 'error', mensaje: e instanceof Error ? e.message : 'No se pudo descargar el volcado.' })
    } finally {
      setExportando(false)
    }
  }

  async function eliminarCuenta() {
    if (!window.confirm('Esto borra tu cuenta y todos tus registros. No se puede deshacer.')) return
    setBorrando(true)
    try {
      await api.eliminarCuenta()
      localStorage.removeItem('nf:peso:outbox')
      localStorage.removeItem('nf:agua:outbox')
      localStorage.removeItem('nf:last_synced_hash')
      localStorage.removeItem(CLAVE_PESO_OBJETIVO)
      indexedDB.deleteDatabase('nutrifit-local')
      window.location.assign('/')
    } catch (e) {
      toast({ tipo: 'error', mensaje: e instanceof Error ? e.message : 'No se pudo eliminar la cuenta.' })
      setBorrando(false)
    }
  }

  const BotonNav = ({ id, label }: { id: SeccionId; label: string }) => (
    <button
      type="button"
      onClick={() => { setSeccionActiva(id); setMovilLista(false); history.replaceState(null, '', `/ajustes#${id}`) }}
      aria-current={seccionActiva === id ? 'page' : undefined}
      className={`flex items-center justify-between text-left px-4 py-3 lg:px-3 lg:py-2 lg:rounded-xl transition ${seccionActiva === id ? 'lg:bg-mint-500/10 lg:text-mint-700 lg:dark:bg-mint-500/20 lg:dark:text-mint-300 lg:font-semibold' : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
    >
      {label}
      <ChevronRight size={16} className="text-neutral-400 lg:hidden" />
    </button>
  )

  const GRUPOS: { titulo: string; items: { id: SeccionId; label: string }[] }[] = [
    { titulo: 'Tú', items: [{ id: 'perfil', label: 'Perfil y objetivos' }, { id: 'estrategia', label: 'Ayuno y estrategia' }] },
    { titulo: 'Hábitos', items: [{ id: 'notificaciones', label: 'Recordatorios y notificaciones' }] },
    { titulo: 'App', items: [{ id: 'preferencias', label: 'Apariencia, idioma y unidades' }, { id: 'conexiones', label: 'Conexiones y apps' }] },
    { titulo: 'Privacidad y datos', items: [{ id: 'dispositivos', label: 'Sesiones y dispositivos' }, { id: 'legal', label: 'Privacidad y legal' }, { id: 'peligro', label: 'Exportar o eliminar datos' }] },
    { titulo: 'Cuenta', items: [{ id: 'cuenta', label: 'Cuenta y sesión' }, { id: 'mas', label: 'Acerca de' }] },
  ]

  return (
    <main className="mx-auto max-w-5xl px-5 pt-3 lg:px-8 lg:pt-2 flex flex-col lg:flex-row gap-4 lg:gap-6">
      <aside className="w-full lg:w-56 shrink-0 lg:sticky lg:top-2 h-max z-10">
        <h1 className="mb-3 text-xl lg:text-2xl font-semibold tracking-tight text-graphite dark:text-neutral-100 hidden lg:block">{t('ajustes.titulo')}</h1>
        {/* Escritorio: barra lateral de secciones. Móvil: lista agrupada → subpantalla con «volver». */}
        <nav className={`${movilLista ? 'flex' : 'hidden'} lg:flex flex-col gap-4 lg:gap-3 text-sm font-medium`} aria-label="Ajustes">
          {GRUPOS.map((g) => (
            <div key={g.titulo}>
              <p className="etiqueta mb-1.5 px-3 lg:mb-1">{g.titulo}</p>
              <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-card divide-y divide-neutral-100 dark:divide-neutral-800 dark:border-neutral-800 dark:bg-card-dark lg:rounded-none lg:border-0 lg:bg-transparent lg:divide-y-0 lg:dark:bg-transparent flex flex-col lg:gap-0.5">
                {g.items.map((it) => <BotonNav key={it.id} id={it.id} label={it.label} />)}
              </div>
            </div>
          ))}
          <button type="button" onClick={() => onSalir()} className="lg:hidden flex items-center justify-center gap-2 rounded-2xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/30">
            <LogOut size={16} /> {t('ajustes.cerrar')}
          </button>
          <p className="lg:hidden text-center text-xs text-neutral-400">NutriFit v{__APP_VERSION__}</p>
        </nav>
        {!movilLista && (
          <button type="button" onClick={() => { setMovilLista(true); history.replaceState(null, '', '/ajustes') }} className="lg:hidden mb-1 inline-flex items-center gap-1 rounded-lg px-1 py-1 text-sm font-medium text-mint-700 dark:text-mint-400">
            <ChevronRight size={16} className="rotate-180" /> Todos los ajustes
          </button>
        )}
      </aside>
      
      <div className={`${movilLista ? 'hidden' : ''} lg:block flex-1 pb-6 min-w-0`}>
        {seccionActiva === 'perfil' && (
        <Seccion id="perfil" titulo={t('ajustes.perfil')}>
          <Input label={t('ajustes.nombre')} value={nombre} maxLength={60} onChange={(e) => setNombre(e.target.value)} />
          <Segmented label={t('ajustes.sexo')} valor={sexo} onChange={setSexo} opciones={[{ valor: 'hombre', etiqueta: t('ajustes.hombre') }, { valor: 'mujer', etiqueta: t('ajustes.mujer') }]} />
          <div className="grid grid-cols-3 gap-3">
            <Input label={t('ajustes.edad')} type="number" inputMode="numeric" value={edad} onChange={(e) => setEdad(e.target.value)} sufijo="años" />
            <Input label={t('ajustes.peso')} type="number" inputMode="decimal" step="0.1" value={peso} onChange={(e) => setPeso(e.target.value)} sufijo="kg" />
            <Input label={t('ajustes.altura')} type="number" inputMode="numeric" value={altura} onChange={(e) => setAltura(e.target.value)} sufijo="cm" />
          </div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">{t('ajustes.actividad')}</span>
            <select className={SELECT} value={actividad} onChange={(e) => setActividad(e.target.value as NivelActividad)}>
              {ACTIVIDADES.map((a) => (
                <option key={a.valor} value={a.valor}>
                  {a.titulo} — {a.descripcion}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">{t('ajustes.objetivo')}</span>
            <select className={SELECT} value={objetivo} onChange={(e) => setObjetivo(e.target.value as Objetivo)}>
              {OBJETIVOS_UI.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.titulo} — {o.descripcion}
                </option>
              ))}
            </select>
          </label>
          <Input label={t('ajustes.peso_objetivo')} hint={t('ajustes.peso_hint')} type="number" inputMode="decimal" step="0.1" value={objetivoPeso} onChange={(e) => setObjetivoPeso(e.target.value)} sufijo="kg" />

          <div className="grid grid-cols-4 gap-2 rounded-2xl bg-neutral-50 p-4 text-center dark:bg-neutral-900/60" aria-live="polite">
            {plan ? (
              <>
                <div>
                  <p className="cifra text-lg font-semibold">{entero(plan.calorias)}</p>
                  <p className="text-2xs uppercase tracking-wider text-neutral-500">kcal</p>
                </div>
                <div>
                  <p className="cifra text-lg font-semibold text-protein">{plan.proteinas}g</p>
                  <p className="text-2xs uppercase tracking-wider text-neutral-500">Prot.</p>
                </div>
                <div>
                  <p className="cifra text-lg font-semibold text-carbs">{plan.carbohidratos}g</p>
                  <p className="text-2xs uppercase tracking-wider text-neutral-500">Carbs</p>
                </div>
                <div>
                  <p className="cifra text-lg font-semibold text-fats">{plan.grasas}g</p>
                  <p className="text-2xs uppercase tracking-wider text-neutral-500">Grasas</p>
                </div>
              </>
            ) : (
              <p className="col-span-4 text-sm text-neutral-500 dark:text-neutral-400">{t('ajustes.completa_datos')}</p>
            )}
          </div>
          <div ref={contenedorRef} className="flex justify-center empty:hidden" />
          {error && (
            <p role="alert" className="text-sm text-protein">
              {error}
            </p>
          )}
          <Button block loading={guardando} onClick={() => void guardar()}>
            {t('ajustes.guardar')}
          </Button>
        </Seccion>
        )}

        {seccionActiva === 'preferencias' && (
          <div className="space-y-8">
            <Seccion id="preferencias" titulo={t('ajustes.idioma')}>
              <Segmented
                label={t('ajustes.idioma')}
                valor={idioma}
                onChange={(siguiente) => cambiarIdioma(siguiente as Idioma)}
                opciones={[
                  { valor: 'es', etiqueta: 'Español' },
                  { valor: 'ca', etiqueta: 'Català' },
                  { valor: 'en', etiqueta: 'English' },
                ]}
              />
            </Seccion>
            <Seccion titulo={t('ajustes.unidades')}>
              <Segmented
                label={t('ajustes.unidades')}
                valor={unidades}
                onChange={(sig) => cambiarUnidades(sig as 'metrico' | 'imperial')}
                opciones={[
                  { valor: 'metrico', etiqueta: t('ajustes.metrico') },
                  { valor: 'imperial', etiqueta: t('ajustes.imperial') },
                ]}
              />
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Afecta a medidas corporales, registro de hidratación y cálculos nutricionales.
              </p>
              <AjusteBebidasAgua />
            </Seccion>
            <Seccion titulo={t('ajustes.apariencia')}>
              <Segmented
                label={t('ajustes.tema')}
                valor={preferencia}
                onChange={cambiar}
                opciones={[
                  { valor: 'sistema', etiqueta: <span className="flex items-center justify-center gap-1.5"><Monitor size={14} /> {t('ajustes.sistema')}</span> },
                  { valor: 'claro', etiqueta: <span className="flex items-center justify-center gap-1.5"><Sun size={14} /> {t('ajustes.claro')}</span> },
                  { valor: 'oscuro', etiqueta: <span className="flex items-center justify-center gap-1.5"><Moon size={14} /> {t('ajustes.oscuro')}</span> },
                ]}
              />
            </Seccion>
          </div>
        )}

        {seccionActiva === 'notificaciones' && (
          <Seccion id="notificaciones" titulo={t('ajustes.notificaciones')}>
            <div className="space-y-4">
              <Suspense fallback={<div className="tarjeta h-40 animate-pulse" />}>
                <SeccionRecordatorios />
              </Suspense>
              {bajaComunicaciones ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/40 dark:bg-amber-950/20 text-sm text-amber-800 dark:text-amber-200 flex items-start gap-3">
                  <Mail className="size-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div>
                    <p className="font-semibold">Baja de comunicaciones no esenciales activada</p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                      Solo recibirás correos transaccionales estrictamente necesarios para acceder a tu cuenta (códigos de seguridad).
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50/60 p-4 dark:border-neutral-800 dark:bg-neutral-900/40 text-sm text-neutral-600 dark:text-neutral-300 flex items-start gap-3">
                  <Mail className="size-5 shrink-0 text-mint mt-0.5" />
                  <div className="flex-1 text-xs">
                    <p className="font-medium text-graphite dark:text-neutral-100">
                      Canal oficial de envío: <code className="bg-neutral-200/60 dark:bg-neutral-800 px-1 py-0.5 rounded font-mono">nutrifit@trujillomingorance.com</code>
                    </p>
                    <p className="mt-1 text-neutral-500 dark:text-neutral-400">
                      Servidores: <span className="font-mono">nutri.trujillomingorance.com</span> · Gateway: <span className="font-mono">api.trujillomingorance.com/nutrifit</span>
                    </p>
                  </div>
                </div>
              )}

              <div className="divide-y divide-neutral-100 dark:divide-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden bg-white dark:bg-card-dark">
                <div className="p-4 flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-graphite dark:text-neutral-100">Correos de Acceso y Seguridad</span>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">Obligatorio</span>
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Códigos de verificación de un solo uso de 6 cifras y enlaces de acceso seguro solicitados por ti.
                    </p>
                  </div>
                  <div className="shrink-0 text-emerald-600 dark:text-emerald-400">
                    <Check size={20} />
                  </div>
                </div>



                <div className="p-4 flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <span className="text-sm font-semibold text-graphite dark:text-neutral-100">Novedades y Actualizaciones</span>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Comunicaciones sobre nuevas funcionalidades de NutriFit y mejoras en la plataforma.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={novedades}
                    onClick={conmutarNovedades}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${novedades ? 'bg-mint' : 'bg-neutral-300 dark:bg-neutral-700'}`}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${novedades ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                <Button
                  variant="outline"
                  onClick={darDeBajaTodas}
                  className="w-full sm:w-auto text-xs text-neutral-600 dark:text-neutral-400 hover:text-red-600 dark:hover:text-red-400"
                >
                  {bajaComunicaciones ? 'Restablecer preferencias de correo' : 'Darme de baja de todas las comunicaciones no esenciales'}
                </Button>
                <span className="text-2xs text-neutral-400 text-center sm:text-right">
                  Cumplimiento RGPD (UE 2016/679) &amp; RFC 8058 One-Click
                </span>
              </div>
            </div>
          </Seccion>
        )}

        {seccionActiva === 'dispositivos' && (
        <Seccion id="dispositivos" titulo={t('ajustes.dispositivos')} noCard>
          <SeccionDispositivos />
        </Seccion>
        )}

        {seccionActiva === 'conexiones' && (
        <Seccion titulo={t('ajustes.conexiones')} noCard>
          <SeccionIntegraciones />
        </Seccion>
        )}

        {seccionActiva === 'estrategia' && (
        <Seccion titulo={t('ajustes.estrategia')} noCard>
          <SeccionPreferenciasAvanzadas />
        </Seccion>
        )}

        {seccionActiva === 'mas' && (
        <Seccion titulo={t('ajustes.mas')} noCard>
          <div className="divide-y divide-neutral-100 bg-card rounded-2xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800 dark:bg-card-dark overflow-hidden mt-6">
            <EstadoServicios />
            {!esNativa && (
              <a
                href="/descargar"
                onClick={(e) => {
                  e.preventDefault()
                  navegar('/descargar')
                }}
                className="flex items-center gap-3 px-4 py-3.5 text-[15px] hover:bg-neutral-50 dark:hover:bg-neutral-900"
              >
                <Download size={18} className="text-neutral-500 dark:text-neutral-400" />
                <div className="flex-1">
                  <span>{t('ajustes.instalar')}</span>
                  <span className="block text-xs text-neutral-400">Guía paso a paso, APK o código QR para tu móvil</span>
                </div>
                <span className="text-xs font-semibold text-mint-600 dark:text-mint-400">Más info / QR →</span>
                <ChevronRight size={16} className="text-neutral-400" />
              </a>
            )}
            <a
              href="/privacidad"
              onClick={(e) => {
                clicPrivacidad(e)
                if (e.defaultPrevented) onClose()
              }}
              className="flex items-center gap-3 px-4 py-3.5 text-[15px] hover:bg-neutral-50 dark:hover:bg-neutral-900"
            >
              <Shield size={18} className="text-neutral-500 dark:text-neutral-400" />
              <span className="flex-1">{t('ajustes.privacidad')}</span>
              <ChevronRight size={16} className="text-neutral-400" />
            </a>
            <a href={URL_REPO} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-3.5 text-[15px] hover:bg-neutral-50 dark:hover:bg-neutral-900">
              <ExternalLink size={18} className="text-neutral-500 dark:text-neutral-400" />
              <span className="flex-1">{t('ajustes.codigo')}</span>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">MIT</span>
            </a>
            <a href="/recursos" onClick={clicRecursos} className="flex items-center gap-3 px-4 py-3.5 text-[15px] hover:bg-neutral-50 dark:hover:bg-neutral-900">
              <FileText size={18} className="text-neutral-500 dark:text-neutral-400" />
              <span className="flex-1">Centro legal y recursos</span>
              <ChevronRight size={16} className="text-neutral-400" />
            </a>
            <a href="mailto:soporte@trujillomingorance.com" className="flex items-center gap-3 px-4 py-3.5 text-[15px] hover:bg-neutral-50 dark:hover:bg-neutral-900">
              <Mail size={18} className="text-neutral-500 dark:text-neutral-400" />
              <span className="flex-1">Soporte</span>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">soporte@trujillomingorance.com</span>
            </a>
            <div className="flex items-center gap-3 px-4 py-3.5 text-[15px]">
              <Shield size={18} className="text-neutral-500 dark:text-neutral-400" />
              <span className="flex-1">Versión</span>
              <span className="cifra text-xs text-neutral-500 dark:text-neutral-400">v{__APP_VERSION__}</span>
            </div>
          </div>
        </Seccion>
        )}

        {seccionActiva === 'legal' && (
          <div className="space-y-6">
            <Seccion id="legal" titulo="Centro Legal y Cumplimiento Normativo">
              <AjusteFondoBlanco />
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20 text-sm text-emerald-900 dark:text-emerald-200 flex items-start gap-3">
                <Shield className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-[15px]">Compromiso de Privacidad y Cumplimiento Normativo</p>
                  <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
                    NutriFit opera bajo el estricto cumplimiento del <strong>Reglamento General de Protección de Datos (RGPD UE 2016/679)</strong>,
                    la <strong>Ley Orgánica 3/2018 (LOPDGDD)</strong> y la <strong>Ley 34/2002 (LSSI-CE)</strong>. Garantizamos <strong>cero venta de datos</strong>,
                    ausencia total de cookies publicitarias o rastreadores comerciales y cifrado en tránsito y reposo.
                  </p>
                </div>
              </div>
            </Seccion>

            <Seccion titulo="Aviso Legal (LSSI-CE art. 10)">
              <div className="space-y-3 text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-2">
                  <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3 bg-neutral-50/50 dark:bg-neutral-900/40">
                    <span className="font-semibold text-neutral-700 dark:text-neutral-200 block text-2xs uppercase tracking-wider mb-1">Titular del Servicio</span>
                    <p className="text-sm font-medium text-graphite dark:text-neutral-100">Alberto Trujillo Mingorance</p>
                    <p className="text-2xs text-neutral-400 mt-0.5">Barcelona, España</p>
                  </div>
                  <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3 bg-neutral-50/50 dark:bg-neutral-900/40">
                    <span className="font-semibold text-neutral-700 dark:text-neutral-200 block text-2xs uppercase tracking-wider mb-1">Contacto Oficial</span>
                    <p className="font-mono text-xs text-mint-700 dark:text-mint-400">nutrifit@trujillomingorance.com</p>
                    <p className="font-mono text-2xs text-neutral-400 mt-0.5">soporte@trujillomingorance.com</p>
                  </div>
                </div>
                <p>
                  <strong>Plataforma y Dominios Oficiales:</strong> La aplicación web progresiva se presta a través del dominio principal{' '}
                  <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono dark:bg-neutral-800">nutri.trujillomingorance.com</code>, con pasarela de borde perimetral en{' '}
                  <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono dark:bg-neutral-800">api.trujillomingorance.com/nutrifit</code> y enrutamiento corporativo en{' '}
                  <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono dark:bg-neutral-800">trujillomingorance.com</code>.
                </p>
                <p>
                  <strong>Licencia y Propiedad Intelectual:</strong> Código distribuido bajo <strong>Licencia Abierta MIT</strong>. Todos los componentes de IA, cálculo metabólico y utilidades son libres y auditables en GitHub.
                </p>
                <p className="text-2xs text-neutral-400 border-l-2 border-neutral-300 dark:border-neutral-700 pl-2 italic">
                  <strong>Aviso de Salud:</strong> NutriFit es una herramienta informativa de registro y estimación de macronutrientes. No constituye asesoramiento médico, diagnóstico clínico ni pauta terapéutica individualizada. Consulta siempre a un profesional sanitario colegiado antes de cambios dietéticos drásticos.
                </p>
              </div>
            </Seccion>

            <Seccion titulo="Política de Privacidad y Tratamiento de Datos (RGPD)">
              <div className="space-y-3 text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">
                <p>
                  <strong>1. Base Jurídica y Legitimación:</strong> Tratamos tus datos antropométricos (edad, sexo, peso, altura, actividad) exclusivamente con base en tu <strong>consentimiento expreso (art. 6.1.a RGPD)</strong> para calcular tu metabolismo basal y requerimientos energéticos.
                </p>
                <p>
                  <strong>2. Inteligencia Artificial Responsable:</strong> El análisis de imágenes y descripción de comidas se procesa mediante modelos multimodales (Google Gemini 2.0 Flash) transmitiendo únicamente la imagen y metadatos del plato sin datos identificativos personales asociados.
                </p>
                <p>
                  <strong>3. Cero Publicidad y Cero Cesión:</strong> Tus datos nutricionales <strong>NUNCA</strong> son vendidos, cedidos, ni compartidos con redes publicitarias, anunciantes o intermediarios de monetización de datos.
                </p>
                <p>
                  <strong>4. Seguridad y Cifrado Perimetral:</strong> Toda la transmisión viaja cifrada bajo <strong>TLS 1.3</strong> en la red perimetral Anycast de Cloudflare, con bases de datos relacionales cifradas y sesiones firmadas criptográficamente con tokens HMAC-SHA256.
                </p>
              </div>
            </Seccion>

            <Seccion titulo="Ejercicio de Derechos ARCO-POL">
              <div className="space-y-3">
                <p className="text-xs text-neutral-600 dark:text-neutral-300">
                  En cumplimiento del RGPD, puedes ejercer tus derechos de <strong>Acceso, Rectificación, Supresión (Derecho al Olvido), Oposición, Portabilidad y Limitación</strong> de forma inmediata:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <Button
                    variant="outline"
                    icon={<Download size={15} />}
                    loading={exportando}
                    onClick={() => void descargarDatos()}
                    className="justify-start text-xs h-11"
                  >
                    Portabilidad: Descargar mis datos (CSV)
                  </Button>
                  <Button
                    variant="outline"
                    icon={<FileText size={15} />}
                    onClick={() => setSeccionActiva('perfil')}
                    className="justify-start text-xs h-11"
                  >
                    Rectificación: Editar mi perfil
                  </Button>
                  <Button
                    variant="outline"
                    icon={<Mail size={15} />}
                    onClick={() => setSeccionActiva('notificaciones')}
                    className="justify-start text-xs h-11"
                  >
                    Oposición: Gestionar notificaciones
                  </Button>
                  <Button
                    variant="outline"
                    icon={<Lock size={15} />}
                    onClick={() => setSeccionActiva('peligro')}
                    className="justify-start text-xs h-11 text-red-600 dark:text-red-400 hover:border-red-300"
                  >
                    Supresión: Borrar mi cuenta (Olvido)
                  </Button>
                </div>
              </div>
            </Seccion>

            <Seccion titulo="Política de Cookies y Almacenamiento Local">
              <div className="space-y-3 text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">
                <p>
                  NutriFit utiliza <strong>exclusivamente cookies técnicas esenciales</strong> para garantizar el inicio de sesión y la seguridad contra ataques CSRF:
                </p>
                <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 divide-y divide-neutral-100 dark:divide-neutral-800 overflow-hidden bg-white dark:bg-card-dark">
                  <div className="p-3">
                    <span className="font-mono text-2xs font-semibold text-mint-700 dark:text-mint-400">__Host-nf_sesion</span>
                    <p className="text-2xs text-neutral-500 dark:text-neutral-400 mt-0.5">Cookie de sesión protegida (HttpOnly, Secure, SameSite=Lax). Almacena el token firmado de autenticación.</p>
                  </div>
                  <div className="p-3">
                    <span className="font-mono text-2xs font-semibold text-mint-700 dark:text-mint-400">__Host-nf_google &amp; __Host-nf_msft</span>
                    <p className="text-2xs text-neutral-500 dark:text-neutral-400 mt-0.5">Cookies de protección CSRF para el flujo de autorización OAuth 2.0 (caducan a los 5 minutos).</p>
                  </div>
                  <div className="p-3">
                    <span className="font-semibold text-graphite dark:text-neutral-200 text-xs">Almacenamiento Local (PWA)</span>
                    <p className="text-2xs text-neutral-500 dark:text-neutral-400 mt-0.5">LocalStorage e IndexedDB para modo sin conexión, caché de platos frecuentes y sincronización en segundo plano.</p>
                  </div>
                </div>
                <p className="text-2xs text-neutral-500 dark:text-neutral-400">
                  🛡️ <strong>0 Cookies de publicidad o seguimiento de terceros.</strong> No utilizamos Google Analytics, Facebook Pixel, ni ninguna tecnología de huella digital de navegador.
                </p>
              </div>
            </Seccion>
          </div>
        )}

        {seccionActiva === 'cuenta' && (
        <Seccion id="cuenta" titulo={t('ajustes.cuenta')}>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t('ajustes.sesion')} <span className="font-medium text-graphite dark:text-neutral-200">{usuario.email}</span>
          </p>
          <div className="flex flex-col gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <a
              href="/recursos"
              onClick={clicRecursos}
              className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50/50 px-3.5 py-2.5 text-xs font-semibold text-graphite hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900/40 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              <span>Recursos Corporativos & Legal (Drive)</span>
              <ChevronRight size={14} className="text-neutral-400" />
            </a>
            <a
              href="/privacidad"
              onClick={clicPrivacidad}
              className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50/50 px-3.5 py-2.5 text-xs font-semibold text-graphite hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900/40 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              <span>Política de Privacidad y RGPD</span>
              <ChevronRight size={14} className="text-neutral-400" />
            </a>
          </div>
          <Button variant="outline" block icon={<Download size={16} />} loading={exportando} onClick={() => void descargarDatos()}>
            {t('ajustes.descargar')}
          </Button>
          <Button variant="outline" block icon={<LogOut size={16} />} onClick={() => onSalir()} className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/30">
            {t('ajustes.cerrar')}
          </Button>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Al cerrar sesión podrás elegir salir solo aquí o en todos tus dispositivos (móvil, PC y app).</p>
        </Seccion>
        )}

        {seccionActiva === 'peligro' && (
        <Seccion id="peligro" titulo="Zona Crítica" noCard>
          <div className="rounded-2xl border border-red-200 bg-red-50/50 p-4 dark:border-red-900/30 dark:bg-red-950/20 mt-6">
            <p className="mb-4 text-sm text-red-600 dark:text-red-400">
              Esta acción es irreversible y borrará todos tus datos.
            </p>
            <Button variant="danger" block loading={borrando} onClick={() => void eliminarCuenta()}>
              {t('ajustes.eliminar')}
            </Button>
          </div>
          <p className="text-center text-2xs text-neutral-500 dark:text-neutral-400 mt-6">NutriFit v{__APP_VERSION__} · Contacto oficial: <a href="mailto:nutrifit@trujillomingorance.com" className="text-mint hover:underline">nutrifit@trujillomingorance.com</a></p>
        </Seccion>
        )}
      </div>
    </main>
  )
}
