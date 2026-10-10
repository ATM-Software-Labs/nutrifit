/** Ajustes: perfil y objetivos (recalculados al momento), tema, cuenta y enlaces. */
import { useMemo, useState } from 'react'
import { ChevronRight, Download, ExternalLink, LogOut, Monitor, Moon, Shield, Sun } from 'lucide-react'
import { URL_REPO } from '../lib/config.ts'
import { clicPrivacidad } from '../lib/rutas.ts'
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
import { SeccionIntegraciones } from './SeccionIntegraciones.tsx'
import { SeccionPreferenciasAvanzadas } from './SeccionPreferenciasAvanzadas.tsx'
import { useIdioma } from '../hooks/useIdioma.ts'
import { ControlInstalar } from './ControlInstalar.tsx'
import type { Idioma } from '../lib/i18n.ts'

const SELECT =
  'h-12 w-full appearance-none rounded-2xl border border-neutral-200 bg-card px-4 text-[15px] focus:border-mint focus:outline-none focus:ring-4 focus:ring-mint/15 dark:border-neutral-800 dark:bg-card-dark'

function Seccion({ id, titulo, children }: { id?: string; titulo: string; children: React.ReactNode }) {
  return (
    <section id={id} className="space-y-4 scroll-mt-8">
      <h3 className="etiqueta">{titulo}</h3>
      {children}
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
  const { contenedorRef, obtenerToken } = useTurnstile('perfil')
  const toast = useToast()

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
      const token = await obtenerToken()
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
      onSalir()
    } catch (e) {
      toast({ tipo: 'error', mensaje: e instanceof Error ? e.message : 'No se pudo eliminar la cuenta.' })
      setBorrando(false)
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-5 pt-6 lg:px-8 lg:pt-10 flex flex-col lg:flex-row gap-8 lg:gap-16">
      <aside className="w-full lg:w-56 shrink-0 lg:sticky lg:top-10 h-max z-10">
        <h1 className="mb-6 text-2xl lg:text-3xl font-semibold tracking-tight text-graphite dark:text-neutral-100 hidden lg:block">{t('ajustes.titulo')}</h1>
        <nav className="hidden lg:flex flex-col gap-1 text-sm font-medium" aria-label="Ajustes">
          <a href="#perfil" className="px-3 py-2 rounded-xl text-graphite dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition">Perfil y Objetivos</a>
          <a href="#preferencias" className="px-3 py-2 rounded-xl text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition">Preferencias</a>
          <a href="#dispositivos" className="px-3 py-2 rounded-xl text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition">Conexiones y Dispositivos</a>
          <a href="#cuenta" className="px-3 py-2 rounded-xl text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition">Cuenta</a>
        </nav>
      </aside>
      <div className="flex-1 space-y-12 pb-2 min-w-0">
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

        <Seccion titulo={t('ajustes.apariencia')}>
          <Segmented
            label={t('ajustes.tema')}
            valor={preferencia}
            onChange={cambiar}
            opciones={[
              { valor: 'sistema', etiqueta: <span className="flex items-center gap-1.5"><Monitor size={14} /> {t('ajustes.sistema')}</span> },
              { valor: 'claro', etiqueta: <span className="flex items-center gap-1.5"><Sun size={14} /> {t('ajustes.claro')}</span> },
              { valor: 'oscuro', etiqueta: <span className="flex items-center gap-1.5"><Moon size={14} /> {t('ajustes.oscuro')}</span> },
            ]}
          />
        </Seccion>

        <Seccion id="dispositivos" titulo={t('ajustes.dispositivos')}>
          <SeccionDispositivos />
        </Seccion>

        <Seccion titulo={t('ajustes.conexiones')}>
          <SeccionIntegraciones />
        </Seccion>

        <Seccion titulo={t('ajustes.estrategia')}>
          <SeccionPreferenciasAvanzadas />
        </Seccion>

        <Seccion titulo={t('ajustes.mas')}>
          <div className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {!esNativa && (
              <ControlInstalar className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-[15px] hover:bg-neutral-50 dark:hover:bg-neutral-900">
                <Download size={18} className="text-neutral-500 dark:text-neutral-400" />
                <span className="flex-1">{t('ajustes.instalar')}</span>
                <ChevronRight size={16} className="text-neutral-400" />
              </ControlInstalar>
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
          </div>
        </Seccion>

        <Seccion id="cuenta" titulo={t('ajustes.cuenta')}>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t('ajustes.sesion')} <span className="font-medium text-graphite dark:text-neutral-200">{usuario.email}</span>
          </p>
          <Button variant="outline" block icon={<Download size={16} />} loading={exportando} onClick={() => void descargarDatos()}>
            {t('ajustes.descargar')}
          </Button>
          <Button variant="outline" block icon={<LogOut size={16} />} onClick={onSalir}>
            {t('ajustes.cerrar')}
          </Button>
        </Seccion>

        <Seccion id="peligro" titulo="Zona Crítica">
          <div className="rounded-2xl border border-red-200 bg-red-50/50 p-4 dark:border-red-900/30 dark:bg-red-950/20">
            <p className="mb-4 text-sm text-red-600 dark:text-red-400">
              Esta acción es irreversible y borrará todos tus datos.
            </p>
            <Button variant="danger" block loading={borrando} onClick={() => void eliminarCuenta()}>
              {t('ajustes.eliminar')}
            </Button>
          </div>
          <p className="text-center text-2xs text-neutral-500 dark:text-neutral-400">NutriFit v{__APP_VERSION__} · {t('ajustes.dudas')} soporte@trujillomingorance.com</p>
        </Seccion>
      </div>
    </main>
  )
}
