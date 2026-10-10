import { useEffect, useState, type FormEvent, type MouseEvent } from 'react'
import { ArrowLeft, BadgeCheck, Flame, User, Trophy, Target, Droplets, Dumbbell, Zap, Users, Rocket, Scale, X } from 'lucide-react'
import { navegar } from '../lib/rutas.ts'
import { useSrcArchivo } from '../lib/archivoSrc.ts'
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
import { CropperModal } from './CropperModal.tsx'
import { useIdioma } from '../hooks/useIdioma.ts'

type Pestana = 'feed' | 'amigos'

interface Amistad {
  id: string
  estado: string
  username: string | null
  direccion: 'enviada' | 'recibida'
}

interface Sugerido {
  id: string
  username: string
  name: string | null
  avatar_url: string | null
  bio: string | null
}

const BANNER_VACIO = 'linear-gradient(135deg, #064e3b 0%, #022c22 100%)'

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

import { FotoAvatar } from './ui/Avatar.tsx'

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
  if (relacion?.estado === 'pendiente' && relacion.direccion === 'enviada') return <span className="shrink-0 text-xs text-neutral-500">Solicitud enviada</span>
  if (relacion?.estado === 'pendiente' && relacion.direccion === 'recibida') {
    return (
      <button type="button" onClick={() => onAceptar(relacion.id)} className="h-9 shrink-0 rounded-xl bg-mint px-3 text-sm font-medium text-white">
        Aceptar
      </button>
    )
  }
  return (
    <button type="button" onClick={onAnadir} className="h-9 shrink-0 rounded-full bg-emerald-500 px-3.5 text-sm font-semibold text-black transition hover:-translate-y-0.5 hover:bg-emerald-400">
      Añadir amigo
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
  return <FotoAvatar key={avatar || nombre} url={avatar} nombre={nombre} />
}

function BannerFoto({ url }: { url: string }) {
  const foto = useSrcArchivo(url)
  const [oculta, setOculta] = useState(false)
  if (!foto || oculta) return null
  return (
    <img
      src={foto}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      className="absolute inset-0 h-full w-full object-cover"
      onError={(evento) => {
        evento.currentTarget.onerror = null
        evento.currentTarget.style.display = 'none'
        setOculta(true)
      }}
    />
  )
}

export function PaginaPerfil({ usuario, onUsuario }: { usuario: Usuario; onUsuario: (u: Usuario) => void }) {
  const toast = useToast()
  const { t } = useIdioma()
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
  const [cargandoSugerencias, setCargandoSugerencias] = useState(false)
  const [cropImage, setCropImage] = useState<{ url: string; tipo: 'avatar' | 'banner' } | null>(null)

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

  async function subir(archivo: File | Blob, clase: 'avatar' | 'banner') {
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

  async function borrarImagen(clase: 'avatar' | 'banner') {
    try {
      if (clase === 'avatar') {
        await api.borrarAvatar()
        setAvatar('')
        onUsuario({ ...usuario, avatar_url: null })
      } else {
        await api.borrarBanner()
        setBanner('')
        onUsuario({ ...usuario, banner_url: null })
      }
      toast({ tipo: 'exito', mensaje: `${clase === 'avatar' ? 'Avatar' : 'Banner'} eliminado.` })
    } catch (e) {
      toast({ tipo: 'error', mensaje: `No se pudo eliminar el ${clase}.` })
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


  useEffect(() => {
    if (pestana !== 'amigos') return
    let vivo = true
    setCargandoSugerencias(true)
    api
      .sugerencias()
      .then((r) => {
        if (!vivo) return
        setSugeridos(Array.isArray(r.suggestions) ? r.suggestions : [])
      })
      .catch((e: unknown) => {
        if (!vivo) return
        toast({ tipo: 'error', mensaje: e instanceof ApiError ? e.message : 'No se pudo cargar la comunidad.' })
      })
      .finally(() => {
        if (vivo) setCargandoSugerencias(false)
      })
    return () => {
      vivo = false
    }
  }, [pestana])

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

  async function seguir(targetUserId: string) {
    const persona = sugeridos.find((s) => s.id === targetUserId)
    const clave = persona?.username.toLowerCase() ?? ''
    setAmistades((prev) => {
      if (!clave || prev.some((a) => a.username?.toLowerCase() === clave)) return prev
      return [...prev, { id: `local-${targetUserId}`, estado: 'pendiente', username: persona?.username ?? null, direccion: 'enviada' }]
    })
    try {
      const r = await api.seguir(targetUserId)
      const estado = r.status === 'accepted' ? 'aceptada' : 'pendiente'
      setAmistades((prev) => prev.map((a) => (a.username?.toLowerCase() === clave ? { ...a, id: r.id, estado } : a)))
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        const lista = await api.amistades().catch(() => null)
        if (lista) setAmistades(lista.amistades)
        return
      }
      setAmistades((prev) => prev.filter((a) => a.id !== `local-${targetUserId}`))
      toast({ tipo: 'error', mensaje: e instanceof ApiError ? e.message : 'No se pudo seguir a esta persona.' })
    }
  }

  function clicListaAmigos(e: MouseEvent<HTMLUListElement>) {
    const boton = (e.target as HTMLElement).closest('button.btn-add-friend')
    const id = boton?.getAttribute('data-user-id')
    if (!id) return
    void seguir(id)
  }

  async function solicitar(nombre: string) {
    const clave = nombre.toLowerCase()
    setAmistades((prev) => {
      if (prev.some((a) => a.username?.toLowerCase() === clave)) return prev
      return [...prev, { id: `local-${clave}`, estado: 'pendiente', username: nombre, direccion: 'enviada' }]
    })
    try {
      const r = await api.solicitarAmistad(nombre)
      setAmistades((prev) => prev.map((a) => (a.username?.toLowerCase() === clave ? { ...a, id: r.id, estado: r.estado } : a)))
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        const lista = await api.amistades().catch(() => null)
        if (lista) setAmistades(lista.amistades)
        return
      }
      setAmistades((prev) => prev.filter((a) => !(a.id.startsWith('local-') && a.username?.toLowerCase() === clave)))
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
  const amigos = amistades.filter((a) => a.estado === 'aceptada').length
  const entrenosMes = sesiones.filter((s) => s.fecha.startsWith(hoy.slice(0, 7))).length
  const nivel = racha >= 100 ? 'Leyenda' : racha >= 30 ? 'Constante' : racha >= 7 ? 'En racha' : 'Inicio'
  const kcalMacro = totales.proteinas * 4 + totales.carbohidratos * 4 + totales.grasas * 9
  const reparto = (kcal: number) => (kcalMacro > 0 ? Math.round((kcal / kcalMacro) * 100) : 0)
  const pctCalorias = metas.calorias > 0 ? Math.round((totales.calorias / metas.calorias) * 100) : 0
  const agua = resumen?.agua_ml ?? 0
  const caloriasOk = metas.calorias > 0 && totales.calorias >= metas.calorias - 200 && totales.calorias <= metas.calorias + 200
  const macrosOk = metas.proteinas > 0 && totales.proteinas >= metas.proteinas * 0.9 && totales.carbohidratos >= metas.carbohidratos * 0.9 && totales.grasas >= metas.grasas * 0.9
  const logros = [
    { id: 'racha7', icono: <Flame size={24} className="text-orange-500" />, titulo: '7 días seguidos', detalle: 'Una semana registrando', ok: racha >= 7 },
    { id: 'racha30', icono: <Flame size={24} className="text-orange-500" />, titulo: '30 días seguidos', detalle: 'Un mes de constancia', ok: racha >= 30 },
    { id: 'racha100', icono: <Flame size={24} className="text-orange-500" />, titulo: '100 días seguidos', detalle: 'Una dedicación increíble', ok: racha >= 100 },
    { id: 'prote', icono: <Dumbbell size={24} className="text-blue-500" />, titulo: 'Meta de proteína', detalle: 'El objetivo de hoy', ok: metas.proteinas > 0 && totales.proteinas >= metas.proteinas },
    { id: 'equilibrio', icono: <Scale size={24} className="text-emerald-500" />, titulo: 'Equilibrio perfecto', detalle: 'Cumpliste tus macros', ok: macrosOk },
    { id: 'calorias', icono: <Target size={24} className="text-purple-500" />, titulo: 'Diana de calorías', detalle: 'Acierto exacto en calorías', ok: caloriasOk },
    { id: 'agua', icono: <Droplets size={24} className="text-cyan-500" />, titulo: 'Hidratación óptima', detalle: 'Más de 2 litros de agua', ok: agua >= 2000 },
    { id: 'deportista', icono: <Trophy size={24} className="text-yellow-500" />, titulo: 'Deportista activo', detalle: 'Has registrado al menos 5 entrenamientos', ok: sesiones.length >= 5 },
    { id: 'intenso', icono: <Zap size={24} className="text-red-500" />, titulo: 'Entrenamiento intenso', detalle: 'Registraste una sesión de alta intensidad', ok: sesiones.some(s => s.intensidad === 'alta') },
    { id: 'social', icono: <Users size={24} className="text-indigo-500" />, titulo: 'Amigable', detalle: 'Tienes al menos 1 amigo', ok: amigos >= 1 },
    { id: 'pionero', icono: <Rocket size={24} className="text-pink-500" />, titulo: 'Pionero', detalle: 'Cuenta creada en NutriFit', ok: Boolean(usuario.creado_en) },
  ]

  return (
    <main className="px-4 pt-3 lg:px-8 lg:pt-6 flex flex-col gap-4 lg:gap-6 min-h-[calc(100vh-80px)]">
      <div className="mx-auto max-w-5xl w-full">
        <header className="flex items-center gap-3 hidden lg:flex mb-4">
          <button onClick={() => navegar('/')} className="rounded-full p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition" aria-label="Volver">
            <ArrowLeft size={20} className="text-graphite dark:text-neutral-100" />
          </button>
          <h1 className="text-xl lg:text-2xl font-semibold tracking-tight text-graphite dark:text-neutral-100">
            Mi Perfil
          </h1>
        </header>
        <div className="relative">
          <div className="bannerContainer relative h-[96px] overflow-hidden rounded-2xl bg-[#022c22]">
            <div className="absolute inset-0" style={{ background: BANNER_VACIO }} />
            {banner ? <BannerFoto key={banner} url={banner} /> : null}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
          </div>
          
          <div className="absolute bottom-3 right-3 flex items-center gap-2">
            {banner && (
              <button 
                type="button" 
                onClick={() => borrarImagen('banner')}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500/80 text-white backdrop-blur-sm transition hover:bg-red-600"
                aria-label="Eliminar banner"
              >
                <X size={14} strokeWidth={2.5} />
              </button>
            )}
            <label className="cursor-pointer rounded-full bg-black/45 px-3 py-1 text-xs text-white backdrop-blur-sm transition hover:bg-black/60">
              Banner
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setCropImage({ url: URL.createObjectURL(f), tipo: 'banner' });
                e.target.value = '';
              }} />
            </label>
          </div>

          <div className="absolute -bottom-8 left-4 flex items-end gap-2">
            <label className="cursor-pointer">
              <span id="userAvatar" className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-[3px] border-[#10b981] bg-mint-50 text-xl font-semibold text-mint-800 shadow-lg ring-2 ring-white dark:bg-mint-950 dark:text-mint-200 dark:ring-[#111827]">
                <FotoAvatar key={avatar || 'vacio'} url={avatar || null} nombre={usuario.nombre || usuario.email || 'NutriFit'} grande />
              </span>
              <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#10b981]" title="Activo">
                <span className="sr-only">Estado activo</span>
              </span>
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setCropImage({ url: URL.createObjectURL(f), tipo: 'avatar' });
                e.target.value = '';
              }} />
            </label>
            {avatar && (
              <button 
                type="button" 
                onClick={() => borrarImagen('avatar')}
                className="mb-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow-sm transition hover:bg-red-600"
                aria-label="Eliminar avatar"
              >
                <X size={14} strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>

        {cropImage && (
          <CropperModal
            imageSrc={cropImage.url}
            aspectRatio={cropImage.tipo === 'avatar' ? 1 : 3}
            onCrop={(blob) => {
              void subir(blob, cropImage.tipo);
              URL.revokeObjectURL(cropImage.url);
              setCropImage(null);
            }}
            onCancel={() => {
              URL.revokeObjectURL(cropImage.url);
              setCropImage(null);
            }}
          />
        )}

        <div className="mt-10 flex items-start justify-between gap-3">
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
            <div className="flex flex-col gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setEditando(true)}
                className="rounded-full border border-neutral-200 bg-card px-4 py-2 text-sm font-semibold text-graphite shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-emerald-500 hover:bg-emerald-500 hover:text-black hover:shadow-md hover:shadow-emerald-500/25 dark:border-neutral-700 dark:bg-card-dark dark:text-neutral-100"
              >
                Editar perfil
              </button>
              <button
                type="button"
                onClick={() => navegar('/ajustes')}
                className="rounded-full border border-neutral-200 bg-card px-4 py-2 text-sm font-semibold text-graphite shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-card-dark dark:text-neutral-100 dark:hover:bg-neutral-800"
              >
                Ajustes (Meta & Físico)
              </button>
            </div>
          )}
        </div>

        <ul className="mt-4 grid grid-cols-3 gap-2">
          <li className="rounded-2xl border border-neutral-200 bg-card px-3 py-3 dark:border-neutral-800 dark:bg-card-dark">
            <p className="cifra text-lg font-semibold leading-none">{racha}</p>
            <p className="mt-1 flex items-center gap-1 text-xs text-neutral-500"><Flame size={12} className="text-emerald-500" aria-hidden="true" /> {t('perfil.racha')}</p>
          </li>
          <li className="rounded-2xl border border-neutral-200 bg-card px-3 py-3 dark:border-neutral-800 dark:bg-card-dark">
            <p className="cifra text-lg font-semibold leading-none">{entrenosMes}</p>
            <p className="mt-1 text-xs text-neutral-500">{t('perfil.sesiones')}</p>
          </li>
          <li className="rounded-2xl border border-neutral-200 bg-card px-3 py-3 dark:border-neutral-800 dark:bg-card-dark">
            <p className="cifra text-lg font-semibold leading-none">{amigos}</p>
            <p className="mt-1 text-xs text-neutral-500">{t('perfil.amigos')}</p>
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
              id={id === 'feed' ? 'tab-feed' : 'tab-friends'}
              type="button"
              role="tab"
              aria-selected={pestana === id}
              onClick={() => setPestana(id)}
              className={`h-10 rounded-xl text-sm font-medium ${pestana === id ? 'bg-mint text-white' : 'border border-neutral-200 dark:border-neutral-800'}`}
            >
              {id === 'feed' ? 'Feed' : t('perfil.amigos')}
            </button>
          ))}
        </div>

        {pestana === 'feed' ? (
          <div className="mt-4 grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
            <section className="tarjeta p-4" aria-labelledby="titulo-macros">
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
            <div className="grid gap-4">
            <section className="tarjeta p-4" aria-labelledby="titulo-logros">
              <h2 id="titulo-logros" className="text-sm font-semibold">{t('perfil.logros')}</h2>
              <ul className="mt-3 flex flex-wrap gap-3">
                {logros.map((logro) => (
                  <li key={logro.id}>
                    <button
                      type="button"
                      className={`group relative flex h-[52px] w-[52px] items-center justify-center rounded-full border text-xl ${logro.ok ? 'border-emerald-500/50 bg-emerald-500/15' : 'border-neutral-300 bg-neutral-100 grayscale dark:border-neutral-700 dark:bg-neutral-900'}`}
                      aria-label={`${logro.titulo}. ${logro.ok ? 'Desbloqueado' : 'Bloqueado'}. ${logro.detalle}`}
                    >
                      <span aria-hidden="true">{logro.ok ? logro.icono : <Trophy size={24} className="text-neutral-400" />}</span>
                      <span role="tooltip" className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-20 hidden w-max max-w-[14rem] -translate-x-1/2 rounded-md bg-neutral-900 px-2 py-1 text-left text-xs font-medium text-white shadow-lg group-hover:block group-focus-visible:block">
                        {logro.titulo}
                        <span className="mt-0.5 block font-normal text-neutral-300">{logro.ok ? 'Desbloqueado' : 'Bloqueado'} · {logro.detalle}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
            <section className="space-y-2" aria-labelledby="titulo-sesiones">
              <h2 id="titulo-sesiones" className="text-sm font-semibold">Sesiones recientes</h2>
              {sesiones.length === 0 ? (
                <p className="text-sm text-neutral-500">Todavía no hay sesiones.</p>
              ) : (
                <ul className="grid gap-2">
                  {sesiones.map((s) => {
                    const item = deporte(s.tipo, s.nombre)
                    return (
                      <li key={s.id} className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-card px-3 py-2 dark:border-neutral-800 dark:bg-card-dark">
                        <span aria-hidden="true" className="text-lg">{item.icono}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{item.titulo}</p>
                          <p className="text-xs text-neutral-500">
                            <time className="cifra" dateTime={s.fecha}>{s.fecha.slice(5)}</time>
                            {' · '}{s.minutos ?? 0} min · {intensidadLegible(s.intensidad)}
                          </p>
                        </div>
                        <span className="cifra shrink-0 rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-semibold text-black">{s.calorias} kcal</span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
            </div>
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
            <section className="tarjeta p-4" aria-busy={cargandoSugerencias}>
              <h2 className="font-semibold">Gente que te podría interesar</h2>
              <p className="mt-1 text-xs text-neutral-500">Perfiles públicos que todavía no son tus amigos.</p>
              {sugeridos.length === 0 && !cargandoSugerencias && <p className="mt-3 text-sm text-neutral-500">Todavía no hay más perfiles públicos.</p>}
              <ul id="friends-list" className="mt-3 grid gap-2" onClick={clicListaAmigos}>
                  {sugeridos.filter((s) => relacion(s.username)?.estado !== 'aceptada').map((s) => {
                    const vinculo = relacion(s.username)
                    const siguiendo = vinculo?.estado === 'aceptada'
                    const enviada = vinculo?.estado === 'pendiente' && vinculo.direccion === 'enviada'
                    const recibida = vinculo?.estado === 'pendiente' && vinculo.direccion === 'recibida'
                    return (
                    <li key={s.id} className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-200 px-3 py-3 dark:border-neutral-800">
                      <div className="flex min-w-0 items-center gap-3">
                        <Cara nombre={s.name || s.username} avatar={s.avatar_url} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{texto(s.name) || s.username}</p>
                          <p className="truncate text-xs text-neutral-500">@{s.username}</p>
                          {s.bio ? <p className="truncate text-xs text-neutral-500">{texto(s.bio)}</p> : null}
                        </div>
                      </div>
                      {siguiendo ? (
                        <span className="shrink-0 text-xs text-neutral-500">{t('perfil.siguiendo')}</span>
                      ) : enviada ? (
                        <span className="shrink-0 text-xs text-neutral-500">Solicitud enviada</span>
                      ) : recibida ? (
                        <button type="button" onClick={() => void responder(vinculo.id, 'aceptada')} className="h-9 shrink-0 rounded-xl bg-mint px-3 text-sm font-medium text-white">Aceptar</button>
                      ) : (
                        <button type="button" className="btn-add-friend h-9 shrink-0 rounded-full bg-emerald-500 px-3.5 text-sm font-semibold text-black transition hover:-translate-y-0.5 hover:bg-emerald-400" data-user-id={s.id}>
                          {t('perfil.seguir')}
                        </button>
                      )}
                    </li>
                    )
                  })}
                </ul>
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
                      {a.estado === 'aceptada' ? t('perfil.amigos') : a.estado === 'pendiente' ? (a.direccion === 'enviada' ? 'Solicitud enviada' : 'Pendiente') : 'Rechazada'}
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
