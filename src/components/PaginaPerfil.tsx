import { useEffect, useState, type FormEvent } from 'react'
import { BadgeCheck, Flame, User } from 'lucide-react'
import { api, ApiError } from '../lib/api.ts'
import { comprimirImagen, ErrorImagen } from '../lib/imagen.ts'
import { hoyISO, sumarDias } from '../lib/fechas.ts'
import { rachaDias } from '../lib/racha.ts'
import { entero } from '../lib/formato.ts'
import { desescaparHtml } from '../../functions/utils/sanitizar.ts'
import { useResumen } from '../hooks/useResumen.ts'
import { useToast } from './ui/Toast.tsx'
import { BarraMacro } from './BarrasMacros.tsx'
import type { Usuario } from '../lib/tipos.ts'

type Pestana = 'feed' | 'amigos'

interface Amistad {
  id: string
  estado: string
  username: string | null
  direccion: 'enviada' | 'recibida'
}

interface Sugerido {
  username: string
  nombre: string | null
  avatar_url: string | null
}

interface Sesion {
  id: string
  tipo: string
  nombre: string | null
  minutos: number | null
  intensidad: string | null
  calorias: number
  fecha: string
}

function texto(v: string | null | undefined): string {
  return v ? desescaparHtml(v) : ''
}

function fotoDirecta(url: string | null): string | null {
  if (!url) return null
  if (url.startsWith('data:image/') || url.startsWith('blob:') || url.startsWith('/api/archivos/') || url.startsWith('https://')) return url
  return null
}

function BotonAmistad({
  relacion,
  onAnadir,
  onAceptar,
}: {
  relacion: Amistad | undefined
  onAnadir: () => void
  onAceptar: (id: string) => void
}) {
  if (relacion?.estado === 'aceptada') return <span className="shrink-0 text-xs text-neutral-500">Amigos</span>
  if (relacion?.estado === 'pendiente' && relacion.direccion === 'enviada') return <span className="shrink-0 text-xs text-neutral-500">Pendiente</span>
  if (relacion?.estado === 'pendiente' && relacion.direccion === 'recibida') {
    return (
      <button type="button" onClick={() => onAceptar(relacion.id)} className="h-9 shrink-0 rounded-xl bg-mint px-3 text-sm font-medium text-white">
        Aceptar
      </button>
    )
  }
  return (
    <button type="button" onClick={onAnadir} className="h-9 shrink-0 rounded-full bg-emerald-500 px-3.5 text-sm font-semibold text-black transition hover:-translate-y-0.5 hover:bg-emerald-400">
      + Añadir
    </button>
  )
}

function deporte(tipo: string, nombre: string | null): { icono: string; titulo: string } {
  const t = `${tipo} ${nombre ?? ''}`.toLowerCase()
  if (t.includes('bici') || t.includes('cicl')) return { icono: '🚴', titulo: nombre || 'Bici' }
  if (t.includes('paseo') || t.includes('camin')) return { icono: '🚶', titulo: nombre || 'Paseo' }
  if (tipo === 'fuerza' || t.includes('fuerza') || t.includes('pesa')) return { icono: '💪', titulo: nombre || 'Fuerza' }
  return { icono: '🏃', titulo: nombre || 'Cardio' }
}

function intensidadLegible(valor: string | null): string {
  if (valor === 'baja') return 'Baja'
  if (valor === 'media') return 'Media'
  if (valor === 'alta') return 'Alta'
  return '—'
}

function AnilloMeta({ valor, meta }: { valor: number; meta: number }) {
  const pct = meta > 0 ? Math.min(100, Math.round((valor / meta) * 100)) : 0
  const radio = 16
  const circunferencia = 2 * Math.PI * radio
  const largo = (pct / 100) * circunferencia
  return (
    <svg viewBox="0 0 40 40" className="h-16 w-16 shrink-0 -rotate-90" role="img" aria-label={`${entero(valor)} de ${entero(meta)} kilocalorías, ${pct} por ciento del objetivo`}>
      <circle cx="20" cy="20" r={radio} fill="none" className="stroke-neutral-200 dark:stroke-neutral-800" strokeWidth="5" />
      <circle
        cx="20"
        cy="20"
        r={radio}
        fill="none"
        stroke="#10b981"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={`${largo} ${circunferencia - largo}`}
      />
    </svg>
  )
}

function Cara({ nombre, avatar }: { nombre: string; avatar: string | null }) {
  const foto = fotoDirecta(avatar)
  const letra = nombre.replace(/^@/, '').trim().charAt(0).toUpperCase() || '?'
  if (foto) return <img src={foto} alt="" width={36} height={36} className="h-9 w-9 shrink-0 rounded-full object-cover" />
  return (
    <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mint-50 text-sm font-semibold text-mint-800 dark:bg-mint-950 dark:text-mint-300">
      {letra}
    </span>
  )
}

export function PaginaPerfil({ usuario, onUsuario }: { usuario: Usuario; onUsuario: (u: Usuario) => void }) {
  const toast = useToast()
  const hoy = hoyISO()
  const { resumen } = useResumen(hoy)
  const [pestana, setPestana] = useState<Pestana>('feed')
  const [username, setUsername] = useState(usuario.username ?? '')
  const [bio, setBio] = useState(usuario.bio ?? '')
  const [avatar, setAvatar] = useState(usuario.avatar_url ?? '')
  const [banner, setBanner] = useState(usuario.banner_url ?? '')
  const [racha, setRacha] = useState(0)
  const [sesiones, setSesiones] = useState<Sesion[]>([])
  const [amistades, setAmistades] = useState<Amistad[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [hallado, setHallado] = useState<{ username: string; nombre: string | null; bio: string | null; avatar_url: string | null } | null>(null)
  const [editando, setEditando] = useState(false)
  const [sugeridos, setSugeridos] = useState<Sugerido[]>([])
  const [paginaComunidad, setPaginaComunidad] = useState(0)
  const [hayMas, setHayMas] = useState(false)
  const [cargandoComunidad, setCargandoComunidad] = useState(false)

  useEffect(() => {
    let vivo = true
    api
      .perfilSocial()
      .then((r) => {
        if (!vivo) return
        setUsername(r.perfil.username ?? '')
        setBio(texto(r.perfil.bio))
        setAvatar(r.perfil.avatar_url ?? '')
        setBanner(r.perfil.banner_url ?? '')
      })
      .catch(() => {})
    api
      .entrenamientosRecientes(30)
      .then((r) => {
        if (vivo) setSesiones(r.entrenamientos)
      })
      .catch(() => {})
    api
      .amistades()
      .then((r) => {
        if (vivo) setAmistades(r.amistades)
      })
      .catch(() => {})
    api
      .historial(sumarDias(hoy, -60), hoy)
      .then((r) => {
        if (!vivo) return
        setRacha(rachaDias(r.dias.filter((d) => d.num_comidas > 0).map((d) => d.fecha), hoy))
      })
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [hoy])

  async function subir(archivo: File, clase: 'avatar' | 'banner') {
    try {
      const blob = await comprimirImagen(archivo)
      if (clase === 'avatar') {
        const r = await api.subirAvatar(blob)
        setAvatar(r.avatar_url)
        onUsuario({ ...usuario, avatar_url: r.avatar_url })
      } else {
        const r = await api.subirBanner(blob)
        setBanner(r.banner_url)
        onUsuario({ ...usuario, banner_url: r.banner_url })
      }
    } catch (e) {
      const mensaje = e instanceof ErrorImagen || e instanceof ApiError ? e.message : 'No se pudo subir la imagen.'
      toast({ tipo: 'error', mensaje })
    }
  }

  async function guardarTexto() {
    const limpio = username.replace(/^@/, '').trim()
    try {
      const r = await api.guardarPerfilSocial({ username: limpio || null, bio: bio.trim() || null })
      setUsername(r.perfil.username ?? '')
      setBio(texto(r.perfil.bio))
      setEditando(false)
      onUsuario({ ...usuario, username: r.perfil.username, bio: texto(r.perfil.bio) })
    } catch (e) {
      toast({ tipo: 'error', mensaje: e instanceof ApiError ? e.message : 'No se pudo guardar el perfil.' })
    }
  }

  async function cargarComunidad(pagina: number, acumular: boolean) {
    setCargandoComunidad(true)
    try {
      const r = await api.comunidad(pagina)
      setSugeridos((prev) => (acumular ? [...prev, ...r.comunidad] : r.comunidad))
      setPaginaComunidad(r.pagina)
      setHayMas(r.hay_mas)
    } catch (e) {
      toast({ tipo: 'error', mensaje: e instanceof ApiError ? e.message : 'No se pudo cargar la comunidad.' })
    } finally {
      setCargandoComunidad(false)
    }
  }

  useEffect(() => {
    if (pestana !== 'amigos' || paginaComunidad > 0) return
    let vivo = true
    setCargandoComunidad(true)
    api
      .comunidad(1)
      .then((r) => {
        if (!vivo) return
        setSugeridos(r.comunidad)
        setPaginaComunidad(r.pagina)
        setHayMas(r.hay_mas)
      })
      .catch((e: unknown) => {
        if (!vivo) return
        toast({ tipo: 'error', mensaje: e instanceof ApiError ? e.message : 'No se pudo cargar la comunidad.' })
      })
      .finally(() => {
        if (vivo) setCargandoComunidad(false)
      })
    return () => {
      vivo = false
    }
  }, [pestana, paginaComunidad])

  async function buscar(e: FormEvent) {
    e.preventDefault()
    const nombre = busqueda.replace(/^@/, '').trim()
    if (!nombre) {
      setHallado(null)
      return
    }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(nombre)) {
      toast({ tipo: 'error', mensaje: 'El usuario tiene entre 3 y 20 letras, números o _.' })
      return
    }
    try {
      const r = await api.perfilPublico(nombre)
      setHallado({ username: r.perfil.username, nombre: texto(r.perfil.nombre), bio: texto(r.perfil.bio), avatar_url: r.perfil.avatar_url })
    } catch (err) {
      setHallado(null)
      toast({ tipo: 'error', mensaje: err instanceof ApiError ? err.message : 'Perfil no encontrado.' })
    }
  }

  function relacion(username: string): Amistad | undefined {
    return amistades.find((a) => a.username?.toLowerCase() === username.toLowerCase())
  }

  async function solicitar(nombre: string) {
    try {
      await api.solicitarAmistad(nombre)
      const r = await api.amistades()
      setAmistades(r.amistades)
    } catch (e) {
      toast({ tipo: 'error', mensaje: e instanceof ApiError ? e.message : 'No se pudo enviar la solicitud.' })
    }
  }

  async function responder(id: string, estado: 'aceptada' | 'rechazada') {
    try {
      await api.responderAmistad(id, estado)
      setAmistades((prev) => prev.map((a) => (a.id === id ? { ...a, estado } : a)))
    } catch (e) {
      toast({ tipo: 'error', mensaje: e instanceof ApiError ? e.message : 'No se pudo actualizar la solicitud.' })
    }
  }

  const metas = resumen?.metas ?? {
    calorias: usuario.meta_calorias ?? 2000,
    proteinas: usuario.meta_proteinas ?? 0,
    carbohidratos: usuario.meta_carbs ?? 0,
    grasas: usuario.meta_grasas ?? 0,
  }
  const totales = resumen?.totales ?? { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 }
  const inicial = (usuario.nombre ?? usuario.email).trim().charAt(0).toUpperCase()
  const amigos = amistades.filter((a) => a.estado === 'aceptada').length
  const entrenosMes = sesiones.filter((s) => s.fecha.startsWith(hoy.slice(0, 7))).length
  const nivel = racha >= 100 ? 'Leyenda' : racha >= 30 ? 'Constante' : racha >= 7 ? 'En racha' : 'Inicio'
  const kcalMacro = totales.proteinas * 4 + totales.carbohidratos * 4 + totales.grasas * 9
  const reparto = (kcal: number) => (kcalMacro > 0 ? Math.round((kcal / kcalMacro) * 100) : 0)
  const pctCalorias = metas.calorias > 0 ? Math.round((totales.calorias / metas.calorias) * 100) : 0
  const logros = [
    { id: 'racha7', titulo: '7 días seguidos', detalle: 'Una semana registrando', ok: racha >= 7 },
    { id: 'prote', titulo: 'Meta de proteína alcanzada', detalle: 'El objetivo de hoy', ok: metas.proteinas > 0 && totales.proteinas >= metas.proteinas },
    { id: 'pionero', titulo: 'Pionero', detalle: 'Cuenta creada en NutriFit', ok: Boolean(usuario.creado_en) },
  ]

  return (
    <main className="px-5 pb-28 lg:px-10 lg:pb-12 lg:pt-8">
      <div className="mx-auto max-w-3xl">
        <div className="relative">
          <div className="relative aspect-[2.4/1] overflow-hidden rounded-3xl bg-[#111827]">
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(circle at 12% 18%, rgba(16,185,129,0.55), transparent 42%), radial-gradient(circle at 88% 8%, rgba(52,211,153,0.32), transparent 34%), radial-gradient(circle at 72% 88%, rgba(6,78,59,0.9), transparent 46%), linear-gradient(135deg, #022c22 0%, #111827 52%, #064e3b 100%)',
              }}
            />
            {banner ? <img src={banner} alt="" className="absolute inset-0 h-full w-full object-cover" /> : null}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
          </div>
          <label className="absolute bottom-3 right-3 cursor-pointer rounded-full bg-black/45 px-3 py-1 text-xs text-white backdrop-blur-sm transition hover:bg-black/60">
            Banner
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void subir(f, 'banner'); e.target.value = '' }} />
          </label>
          <label className="absolute -bottom-11 left-5 cursor-pointer">
            <span className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-[#10b981] bg-mint-50 text-2xl font-semibold text-mint-800 shadow-lg ring-2 ring-white dark:bg-mint-950 dark:text-mint-200 dark:ring-[#111827]">
              {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : inicial}
            </span>
            <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-white bg-[#10b981]" title="Activo">
              <span className="sr-only">Estado activo</span>
            </span>
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void subir(f, 'avatar'); e.target.value = '' }} />
          </label>
        </div>

        <div className="mt-16 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-1.5 truncate text-2xl font-semibold tracking-tight">
              {usuario.nombre || 'Tu perfil'}
              {username && <BadgeCheck size={18} className="shrink-0 text-emerald-500" aria-label="Usuario verificado" />}
            </h1>
            <p className="text-sm text-mint-700 dark:text-mint-400">{username ? `@${username}` : 'Sin nombre de usuario'}</p>
            <p className="mt-1 inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">Nivel {nivel}</p>
            {bio && <p className="mt-2 max-w-prose text-sm text-neutral-600 dark:text-neutral-300">{bio}</p>}
          </div>
          {!editando && (
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="shrink-0 rounded-full border border-neutral-200 bg-card px-4 py-2 text-sm font-semibold text-graphite shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-emerald-500 hover:bg-emerald-500 hover:text-black hover:shadow-md hover:shadow-emerald-500/25 dark:border-neutral-700 dark:bg-card-dark dark:text-neutral-100"
            >
              Editar perfil
            </button>
          )}
        </div>

        <ul className="mt-4 grid grid-cols-3 gap-2">
          <li className="rounded-2xl border border-neutral-200 bg-card px-3 py-3 dark:border-neutral-800 dark:bg-card-dark">
            <p className="cifra text-lg font-semibold leading-none">{racha}</p>
            <p className="mt-1 flex items-center gap-1 text-xs text-neutral-500"><Flame size={12} className="text-emerald-500" aria-hidden="true" /> Días en racha</p>
          </li>
          <li className="rounded-2xl border border-neutral-200 bg-card px-3 py-3 dark:border-neutral-800 dark:bg-card-dark">
            <p className="cifra text-lg font-semibold leading-none">{entrenosMes}</p>
            <p className="mt-1 text-xs text-neutral-500">Sesiones este mes</p>
          </li>
          <li className="rounded-2xl border border-neutral-200 bg-card px-3 py-3 dark:border-neutral-800 dark:bg-card-dark">
            <p className="cifra text-lg font-semibold leading-none">{amigos}</p>
            <p className="mt-1 text-xs text-neutral-500">Amigos</p>
          </li>
        </ul>

        {editando ? (
          <form
            className="tarjeta mt-4 space-y-3 p-4"
            onSubmit={(e) => {
              e.preventDefault()
              void guardarTexto()
            }}
          >
            <label className="block text-sm">
              Usuario
              <input value={username} onChange={(e) => setUsername(e.target.value)} maxLength={20} className="mt-1 h-10 w-full rounded-xl border border-neutral-200 bg-transparent px-3 dark:border-neutral-800" />
            </label>
            <label className="block text-sm">
              Biografía
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={160} rows={3} className="mt-1 w-full rounded-xl border border-neutral-200 bg-transparent px-3 py-2 dark:border-neutral-800" />
            </label>
            <div className="flex gap-2">
              <button type="submit" className="h-9 rounded-xl bg-mint px-3 text-sm font-medium text-white">Guardar</button>
              <button type="button" onClick={() => setEditando(false)} className="h-9 rounded-xl px-3 text-sm text-neutral-500">Cancelar</button>
            </div>
          </form>
        ) : null}

        <div className="mt-6 grid grid-cols-2 gap-2" role="tablist">
          {(['feed', 'amigos'] as const).map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={pestana === id}
              onClick={() => setPestana(id)}
              className={`h-10 rounded-xl text-sm font-medium ${pestana === id ? 'bg-mint text-white' : 'border border-neutral-200 dark:border-neutral-800'}`}
            >
              {id === 'feed' ? 'Feed' : 'Amigos'}
            </button>
          ))}
        </div>

        {pestana === 'feed' ? (
          <div className="mt-4 space-y-4">
            <section className="tarjeta p-5" aria-labelledby="titulo-macros">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 id="titulo-macros" className="font-semibold">Macros de hoy</h2>
                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                    <span className="cifra font-semibold text-graphite dark:text-white">{entero(totales.calorias)}</span>
                    <span className="cifra"> / {entero(metas.calorias)} kcal</span>
                    <span className="ml-2 text-xs text-neutral-500">{pctCalorias}%</span>
                  </p>
                </div>
                <AnilloMeta valor={totales.calorias} meta={metas.calorias} />
              </div>
              <div
                className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800"
                role="progressbar"
                aria-label="Calorías de hoy"
                aria-valuemin={0}
                aria-valuemax={metas.calorias}
                aria-valuenow={Math.round(totales.calorias)}
                aria-valuetext={`${entero(totales.calorias)} de ${entero(metas.calorias)} kilocalorías`}
              >
                <div className="h-full rounded-full bg-mint" style={{ width: `${Math.min(100, pctCalorias)}%` }} />
              </div>
              <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800" aria-hidden="true">
                <div className="bg-protein" style={{ width: `${reparto(totales.proteinas * 4)}%` }} />
                <div className="bg-carbs" style={{ width: `${reparto(totales.carbohidratos * 4)}%` }} />
                <div className="bg-fats" style={{ width: `${reparto(totales.grasas * 9)}%` }} />
              </div>
              <div className="mt-4 space-y-4">
                <BarraMacro macro="proteinas" valor={totales.proteinas} meta={metas.proteinas} />
                <BarraMacro macro="carbohidratos" valor={totales.carbohidratos} meta={metas.carbohidratos} />
                <BarraMacro macro="grasas" valor={totales.grasas} meta={metas.grasas} />
              </div>
            </section>
            <section className="tarjeta p-5" aria-labelledby="titulo-logros">
              <h2 id="titulo-logros" className="font-semibold">Logros</h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-3">
                {logros.map((logro) => (
                  <li key={logro.id} className={`rounded-2xl border px-3 py-3 ${logro.ok ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-neutral-200 opacity-60 dark:border-neutral-800'}`}>
                    <p className="text-sm font-semibold">{logro.ok ? '🏅' : '🔒'} {logro.titulo}</p>
                    <p className="mt-1 text-xs text-neutral-500">{logro.ok ? 'Desbloqueado' : 'Bloqueado'} · {logro.detalle}</p>
                  </li>
                ))}
              </ul>
            </section>
            <section className="space-y-3" aria-labelledby="titulo-sesiones">
              <h2 id="titulo-sesiones" className="font-semibold">Sesiones recientes</h2>
              {sesiones.length === 0 ? (
                <p className="text-sm text-neutral-500">Todavía no hay sesiones.</p>
              ) : (
                <ul className="grid gap-3">
                  {sesiones.map((s) => {
                    const item = deporte(s.tipo, s.nombre)
                    return (
                      <li key={s.id} className="tarjeta p-4">
                        <div className="flex items-start justify-between gap-3">
                          <p className="flex min-w-0 items-center gap-2 font-semibold">
                            <span aria-hidden="true" className="text-xl">{item.icono}</span>
                            <span className="truncate">{item.titulo}</span>
                          </p>
                          <time className="cifra shrink-0 text-xs text-neutral-500" dateTime={s.fecha}>{s.fecha.slice(5)}</time>
                        </div>
                        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                          <div className="rounded-xl bg-neutral-50 px-2 py-2 dark:bg-neutral-900">
                            <dt className="text-2xs uppercase tracking-wide text-neutral-500">Duración</dt>
                            <dd className="cifra mt-1 text-sm font-semibold">{s.minutos ?? 0} min</dd>
                          </div>
                          <div className="rounded-xl bg-neutral-50 px-2 py-2 dark:bg-neutral-900">
                            <dt className="text-2xs uppercase tracking-wide text-neutral-500">Intensidad</dt>
                            <dd className="mt-1 text-sm font-semibold">{intensidadLegible(s.intensidad)}</dd>
                          </div>
                          <div className="rounded-xl bg-emerald-50 px-2 py-2 dark:bg-emerald-950/40">
                            <dt className="text-2xs uppercase tracking-wide text-neutral-500">Calorías</dt>
                            <dd className="mt-1"><span className="cifra inline-flex rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-semibold text-black">{s.calorias} kcal</span></dd>
                          </div>
                        </dl>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <form className="tarjeta flex gap-2 p-4" onSubmit={(e) => void buscar(e)}>
              <label className="sr-only" htmlFor="buscar-usuario">Buscar por usuario</label>
              <span className="flex h-10 items-center pl-3 text-neutral-400"><User size={16} /></span>
              <input
                id="buscar-usuario"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="@usuario"
                className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
              <button type="submit" className="h-10 rounded-xl bg-mint px-3 text-sm font-medium text-white">Buscar</button>
            </form>
            {hallado && (
              <div className="tarjeta flex items-center justify-between gap-3 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <Cara nombre={hallado.username} avatar={hallado.avatar_url} />
                  <div className="min-w-0">
                    <p className="truncate font-medium">@{hallado.username}</p>
                    <p className="truncate text-sm text-neutral-500">{hallado.nombre || 'Perfil público'}{hallado.bio ? ` · ${hallado.bio}` : ''}</p>
                  </div>
                </div>
                <BotonAmistad relacion={relacion(hallado.username)} onAnadir={() => void solicitar(hallado.username)} onAceptar={(id) => void responder(id, 'aceptada')} />
              </div>
            )}
            <section className="tarjeta p-4" aria-busy={cargandoComunidad}>
              <h2 className="font-semibold">Usuarios sugeridos</h2>
              <p className="mt-1 text-xs text-neutral-500">Comunidad pública, de 5 en 5.</p>
              {sugeridos.length === 0 && !cargandoComunidad && <p className="mt-3 text-sm text-neutral-500">Todavía no hay más perfiles públicos.</p>}
              <ul className="mt-3 grid gap-2">
                  {sugeridos.map((s) => (
                    <li key={s.username} className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-200 px-3 py-3 dark:border-neutral-800">
                      <div className="flex min-w-0 items-center gap-3">
                        <Cara nombre={s.nombre || s.username} avatar={s.avatar_url} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{s.nombre || s.username}</p>
                          <p className="truncate text-xs text-neutral-500">@{s.username}</p>
                        </div>
                      </div>
                      <BotonAmistad relacion={relacion(s.username)} onAnadir={() => void solicitar(s.username)} onAceptar={(id) => void responder(id, 'aceptada')} />
                    </li>
                  ))}
                </ul>
              {hayMas && (
                <button type="button" disabled={cargandoComunidad} onClick={() => void cargarComunidad(paginaComunidad + 1, true)} className="mt-3 h-9 rounded-xl border border-neutral-200 px-3 text-sm dark:border-neutral-800">
                  {cargandoComunidad ? 'Cargando…' : 'Ver más'}
                </button>
              )}
            </section>
            {amistades.length > 0 && (
            <ul className="tarjeta divide-y divide-neutral-100 px-4 dark:divide-neutral-800">
              {amistades.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span className="min-w-0 truncate">@{a.username || 'usuario'}</span>
                  {a.estado === 'pendiente' && a.direccion === 'recibida' ? (
                    <span className="flex gap-2">
                      <button type="button" onClick={() => void responder(a.id, 'aceptada')} className="text-mint-700 dark:text-mint-400">Aceptar</button>
                      <button type="button" onClick={() => void responder(a.id, 'rechazada')} className="text-neutral-500">Rechazar</button>
                    </span>
                  ) : (
                    <span className="text-xs text-neutral-500">
                      {a.estado === 'aceptada' ? 'Amigos' : a.estado === 'pendiente' ? 'Pendiente' : 'Rechazada'}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
