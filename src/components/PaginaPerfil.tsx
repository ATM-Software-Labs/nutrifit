import { useEffect, useState, type FormEvent } from 'react'
import { Flame, User } from 'lucide-react'
import { api, ApiError } from '../lib/api.ts'
import { compressFoodImage, ErrorImagen } from '../lib/imagen.ts'
import { hoyISO, sumarDias } from '../lib/fechas.ts'
import { rachaDias } from '../lib/racha.ts'
import { entero } from '../lib/formato.ts'
import { desescaparHtml } from '../../functions/utils/sanitizar.ts'
import { useResumen } from '../hooks/useResumen.ts'
import { useToast } from './ui/Toast.tsx'
import type { Usuario } from '../lib/tipos.ts'

type Pestana = 'feed' | 'amigos'

interface Amistad {
  id: string
  estado: string
  username: string | null
  direccion: 'enviada' | 'recibida'
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
  const [hallado, setHallado] = useState<{ username: string; nombre: string | null; bio: string | null } | null>(null)
  const [editando, setEditando] = useState(false)

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
      .entrenamientosRecientes(12)
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
      const blob = await (await fetch(await compressFoodImage(archivo))).blob()
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

  async function buscar(e: FormEvent) {
    e.preventDefault()
    const nombre = busqueda.replace(/^@/, '').trim()
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(nombre)) {
      toast({ tipo: 'error', mensaje: 'El usuario tiene entre 3 y 20 letras, números o _.' })
      return
    }
    try {
      const r = await api.perfilPublico(nombre)
      setHallado({ username: r.perfil.username, nombre: texto(r.perfil.nombre), bio: texto(r.perfil.bio) })
    } catch (err) {
      setHallado(null)
      toast({ tipo: 'error', mensaje: err instanceof ApiError ? err.message : 'Perfil no encontrado.' })
    }
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

  const kcalP = (resumen?.totales.proteinas ?? 0) * 4
  const kcalC = (resumen?.totales.carbohidratos ?? 0) * 4
  const kcalG = (resumen?.totales.grasas ?? 0) * 9
  const suma = kcalP + kcalC + kcalG
  const pct = (n: number) => (suma > 0 ? Math.round((n / suma) * 100) : 0)
  const inicial = (usuario.nombre ?? usuario.email).trim().charAt(0).toUpperCase()

  return (
    <main className="px-5 pb-28 lg:px-10 lg:pb-12 lg:pt-8">
      <div className="mx-auto max-w-3xl">
        <div className="relative">
          <div className="aspect-[3/1] overflow-hidden rounded-3xl bg-mint-950">
            {banner ? <img src={banner} alt="" className="h-full w-full object-cover" /> : null}
          </div>
          <label className="absolute bottom-3 right-3 cursor-pointer rounded-full bg-black/40 px-3 py-1 text-xs text-white backdrop-blur-sm">
            Banner
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void subir(f, 'banner'); e.target.value = '' }} />
          </label>
          <label className="absolute -bottom-10 left-5 cursor-pointer">
            <span className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-bg bg-mint-50 text-2xl font-semibold text-mint-800 dark:border-bg-dark dark:bg-mint-950 dark:text-mint-300">
              {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : inicial}
            </span>
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void subir(f, 'avatar'); e.target.value = '' }} />
          </label>
        </div>

        <div className="mt-14 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{usuario.nombre || 'Tu perfil'}</h1>
            <p className="text-sm text-mint-700 dark:text-mint-400">{username ? `@${username}` : 'Sin nombre de usuario'}</p>
            {bio && <p className="mt-2 max-w-prose text-sm text-neutral-600 dark:text-neutral-300">{bio}</p>}
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-mint-50 px-2.5 py-1 text-xs font-medium text-mint-800 dark:bg-mint-950 dark:text-mint-300">
            <Flame size={14} /> {racha} {racha === 1 ? 'día' : 'días'}
          </span>
        </div>

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
        ) : (
          <button type="button" onClick={() => setEditando(true)} className="mt-3 text-sm font-medium text-mint-700 dark:text-mint-400">
            Editar perfil
          </button>
        )}

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
            <section className="tarjeta p-5">
              <h2 className="font-semibold">Sesiones recientes</h2>
              {sesiones.length === 0 ? (
                <p className="mt-2 text-sm text-neutral-500">Todavía no hay sesiones.</p>
              ) : (
                <ul className="mt-2 divide-y divide-neutral-100 dark:divide-neutral-800">
                  {sesiones.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="min-w-0 truncate">{s.nombre || s.tipo} · {s.minutos ?? 0} min{s.intensidad ? ` · ${s.intensidad}` : ''}</span>
                      <span className="cifra shrink-0 text-neutral-500">{s.fecha} · {s.calorias} kcal</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="tarjeta p-5">
              <h2 className="font-semibold">Macros de hoy</h2>
              <ul className="mt-3 space-y-2 text-sm">
                <li className="flex justify-between"><span className="text-protein">Proteína</span><span className="cifra">{pct(kcalP)}%</span></li>
                <li className="flex justify-between"><span className="text-carbs">Hidratos</span><span className="cifra">{pct(kcalC)}%</span></li>
                <li className="flex justify-between"><span className="text-fats">Grasas</span><span className="cifra">{pct(kcalG)}%</span></li>
              </ul>
              <p className="mt-2 text-xs text-neutral-500">{entero(resumen?.totales.calorias ?? 0)} kcal registradas hoy</p>
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
                <div className="min-w-0">
                  <p className="truncate font-medium">@{hallado.username}</p>
                  <p className="truncate text-sm text-neutral-500">{hallado.nombre || 'Perfil público'}{hallado.bio ? ` · ${hallado.bio}` : ''}</p>
                </div>
                <button type="button" onClick={() => void solicitar(hallado.username)} className="h-9 shrink-0 rounded-xl border border-mint/40 px-3 text-sm text-mint-700 dark:text-mint-300">
                  Solicitar
                </button>
              </div>
            )}
            <ul className="tarjeta divide-y divide-neutral-100 px-4 dark:divide-neutral-800">
              {amistades.length === 0 && <li className="py-4 text-sm text-neutral-500">Sin solicitudes ni amigos.</li>}
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
          </div>
        )}
      </div>
    </main>
  )
}
