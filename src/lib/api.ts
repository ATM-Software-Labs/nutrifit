/**
 * Cliente de la API (/api/*).
 *  · Web: mismo origen → la cookie nf_session viaja sola (HttpOnly, SameSite=Strict).
 *  · App Android: URL absoluta a producción + `Authorization: Bearer`, sin cookies.
 * Los errores se normalizan en ApiError.
 */
import { API_BASE, esNativa } from './plataforma.ts'
import { borrarTokenApp, obtenerTokenApp } from './tokenApp.ts'
import type { PlanMacros } from './macros.ts'
import type { Comida, DatosPerfil, NuevaComida, Resumen, ResultadoAnalisis, Usuario } from './tipos.ts'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public codigo?: string,
    public detalles?: { campo: string; mensaje: string }[],
    public reintentarEn?: number,
  ) {
    super(message)
  }
}

let alPerderSesion: (() => void) | null = null
/** Registra qué hacer si una petición autenticada devuelve 401 (sesión caducada). */
export function onSesionPerdida(fn: () => void) {
  alPerderSesion = fn
}

interface Opciones {
  method?: string
  body?: unknown
  turnstile?: string
  signal?: AbortSignal
  /** No disparar onSesionPerdida (p. ej. en /auth/yo al arrancar). */
  silencio401?: boolean
}

async function pedir<T>(ruta: string, o: Opciones = {}): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' }
  let body: BodyInit | undefined
  if (o.body instanceof FormData) body = o.body
  else if (o.body !== undefined) {
    headers['content-type'] = 'application/json'
    body = JSON.stringify(o.body)
  }
  if (o.turnstile) headers['CF-Turnstile-Token'] = o.turnstile
  const token = esNativa ? await obtenerTokenApp() : null
  if (token) headers.authorization = `Bearer ${token}`

  let res: Response
  try {
    res = await fetch(API_BASE + ruta, { method: o.method ?? 'GET', headers, body, signal: o.signal, credentials: esNativa ? 'omit' : 'same-origin' })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new ApiError(0, 'Sin conexión. Revisa tu red e inténtalo de nuevo.', 'red')
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    if (res.status === 401 && token) await borrarTokenApp() // revocado o caducado
    if (res.status === 401 && !o.silencio401) alPerderSesion?.()
    throw new ApiError(
      res.status,
      (data.error as string) ?? 'Algo ha fallado. Inténtalo de nuevo.',
      data.codigo as string | undefined,
      data.detalles as ApiError['detalles'],
      data.reintentarEn as number | undefined,
    )
  }
  return data as T
}

export const api = {
  config: () => pedir<{ turnstileSiteKey: string | null }>('/api/config'),

  yo: async (): Promise<{ ok: true; usuario: Usuario | null; perfilCompleto: boolean }> => {
    // En la app, sin token no hay sesión posible: ni siquiera preguntamos.
    if (esNativa && !(await obtenerTokenApp())) return { ok: true, usuario: null, perfilCompleto: false }
    return pedir('/api/auth/yo', { silencio401: true })
  },
  /** App Android: canjea el token del magic link por un token Bearer. */
  canjearToken: (token: string) =>
    pedir<{ ok: true; token: string; expira: number; usuario: Usuario; perfilCompleto: boolean }>('/api/auth/token', { method: 'POST', body: { token }, silencio401: true }),
  solicitarEnlace: (email: string, turnstile: string) =>
    pedir<{ ok: true; mensaje: string }>('/api/auth/solicitar', { method: 'POST', body: { email, cliente: esNativa ? 'app' : 'web' }, turnstile }),
  salir: () => pedir<{ ok: true }>('/api/auth/salir', { method: 'POST' }),

  guardarPerfil: (datos: DatosPerfil, turnstile: string) =>
    pedir<{ ok: true; usuario: Usuario; plan: PlanMacros }>('/api/usuarios/perfil', { method: 'POST', body: datos, turnstile }),

  resumen: (fecha: string, signal?: AbortSignal) =>
    pedir<Resumen & { ok: true }>(`/api/comidas/resumen?fecha=${encodeURIComponent(fecha)}`, { signal }),
  guardarComida: (c: NuevaComida) => pedir<{ ok: true; comida: Comida }>('/api/comidas/guardar', { method: 'POST', body: c }),
  borrarComida: (id: string) => pedir<{ ok: true }>(`/api/comidas/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  analizar: (imagen: Blob, turnstile: string) => {
    const fd = new FormData()
    fd.append('imagen', imagen, imagen.type === 'image/webp' ? 'plato.webp' : 'plato.jpg')
    return pedir<{ ok: true; proveedor: 'gemini' | 'workers-ai'; resultado: ResultadoAnalisis }>('/api/comidas/analizar', {
      method: 'POST',
      body: fd,
      turnstile,
    })
  },

  agua: (fecha: string, ml: number, modo: 'sumar' | 'fijar' = 'sumar') =>
    pedir<{ ok: true; fecha: string; ml: number }>('/api/agua', { method: 'POST', body: { fecha, ml, modo } }),

  pesos: (dias = 30) => pedir<{ ok: true; dias: number; registros: { fecha: string; peso: number }[] }>(`/api/peso?dias=${dias}`),
  registrarPeso: (peso: number, fecha?: string) =>
    pedir<{ ok: true; registro: { fecha: string; peso: number } }>('/api/peso', { method: 'POST', body: { peso, fecha } }),
}
