/**
 * Cliente de la API (/api/*).
 *  · Web: mismo origen → la cookie nf_session viaja sola (HttpOnly, SameSite=Strict).
 *  · App Android: URL absoluta a producción + `Authorization: Bearer`, sin cookies.
 * Los errores se normalizan en ApiError.
 */
import { API_BASE, esNativa } from './plataforma.ts'
import { borrarTokenApp, obtenerTokenApp } from './tokenApp.ts'
import type { PlanMacros } from './macros.ts'
import type { Comida, DatosPerfil, Historial, InfoVinculo, NuevaComida, ProductoOFF, Resumen, ResultadoAnalisis, Usuario } from './tipos.ts'

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
  const res = await enviar(ruta, o, 'application/json')
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) await lanzar(res, data, o)
  return data as T
}

async function lanzar(res: Response, data: Record<string, unknown>, o: Opciones): Promise<never> {
  if (res.status === 401 && esNativa && (await obtenerTokenApp())) await borrarTokenApp() // revocado o caducado
  if (res.status === 401 && !o.silencio401) alPerderSesion?.()
  throw new ApiError(
    res.status,
    (data.error as string) ?? 'Algo ha fallado. Inténtalo de nuevo.',
    data.codigo as string | undefined,
    data.detalles as ApiError['detalles'],
    data.reintentarEn as number | undefined,
  )
}

/** Descarga un archivo autenticado (CSV): devuelve el Blob y el nombre de Content-Disposition. */
async function descargar(ruta: string): Promise<{ blob: Blob; nombre: string }> {
  const res = await enviar(ruta, {}, 'text/csv, application/json')
  if (!res.ok) await lanzar(res, (await res.json().catch(() => ({}))) as Record<string, unknown>, {})
  const cd = res.headers.get('content-disposition') ?? ''
  const nombre = /filename="?([^";]+)"?/i.exec(cd)?.[1] ?? 'nutrifit.csv'
  return { blob: await res.blob(), nombre }
}

async function enviar(ruta: string, o: Opciones, accept: string): Promise<Response> {
  const headers: Record<string, string> = { accept }
  let body: BodyInit | undefined
  if (o.body instanceof FormData) body = o.body
  else if (o.body !== undefined) {
    headers['content-type'] = 'application/json'
    body = JSON.stringify(o.body)
  }
  if (o.turnstile) headers['CF-Turnstile-Token'] = o.turnstile
  const token = esNativa ? await obtenerTokenApp() : null
  if (token) headers.authorization = `Bearer ${token}`

  try {
    return await fetch(API_BASE + ruta, { method: o.method ?? 'GET', headers, body, signal: o.signal, credentials: esNativa ? 'omit' : 'same-origin' })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new ApiError(0, 'Sin conexión. Revisa tu red e inténtalo de nuevo.', 'red')
  }
}

type Entrada = { ok: true; usuario: Usuario; perfilCompleto: boolean }
const q = (o: Record<string, string>) => new URLSearchParams(o).toString()

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
  /** Código de 6 cifras del email. Web → cookie; app → token Bearer en la respuesta. */
  entrarConCodigo: (email: string, codigo: string) =>
    pedir<Entrada & { token?: string }>('/api/auth/codigo', { method: 'POST', body: { email, codigo, cliente: esNativa ? 'app' : 'web' }, silencio401: true }),

  // Login en el PC con QR: el PC crea y consulta; el móvil (con sesión) ve y decide.
  qrCrear: (secretoHash: string) => pedir<{ ok: true; id: string; codigo: string; expira: number; url: string }>('/api/auth/qr/crear', { method: 'POST', body: { secretoHash } }),
  qrEstado: (id: string, secreto: string, signal?: AbortSignal) =>
    pedir<{ ok: true; estado: 'pendiente' | 'rechazado' | 'caducado' | 'invalido' } | (Entrada & { estado: 'aprobado' })>('/api/auth/qr/estado', {
      method: 'POST',
      body: { id, secreto },
      signal,
      silencio401: true,
    }),
  qrInfo: (id: string) => pedir<{ ok: true } & InfoVinculo>(`/api/auth/qr/info?${q({ id })}`),
  qrDecidir: (id: string, aprobar: boolean) => pedir<{ ok: true; aprobado: boolean }>('/api/auth/qr/decidir', { method: 'POST', body: { id, aprobar } }),

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

  analizarTexto: (descripcion: string, turnstile: string) =>
    pedir<{ ok: true; proveedor: 'gemini' | 'workers-ai'; resultado: ResultadoAnalisis }>('/api/comidas/analizar-texto', {
      method: 'POST',
      body: { descripcion },
      turnstile,
    }),
  /** Open Food Facts vía nuestro servidor: por nombre o por código de barras. */
  off: (busqueda: { q: string } | { codigo: string }, signal?: AbortSignal) =>
    pedir<{ ok: true; productos: ProductoOFF[] }>(`/api/alimentos/off?${q(busqueda as Record<string, string>)}`, { signal }),

  /** Versión y tamaño del último APK (pública; null si GitHub no responde). */
  versionApp: () => pedir<{ ok: true; version: string | null; tamano: number | null; fecha: string | null }>('/api/app/version', { silencio401: true }),

  historial: (desde: string, hasta: string, signal?: AbortSignal) => pedir<{ ok: true } & Historial>(`/api/historial?${q({ desde, hasta })}`, { signal }),
  exportarCsv: (tipo: 'comidas' | 'peso' | 'agua', desde: string, hasta: string) => descargar(`/api/exportar?${q({ tipo, desde, hasta })}`),

  agua: (fecha: string, ml: number, modo: 'sumar' | 'fijar' = 'sumar') =>
    pedir<{ ok: true; fecha: string; ml: number }>('/api/agua', { method: 'POST', body: { fecha, ml, modo } }),

  pesos: (dias = 30) => pedir<{ ok: true; dias: number; registros: { fecha: string; peso: number }[] }>(`/api/peso?dias=${dias}`),
  registrarPeso: (peso: number, fecha?: string) =>
    pedir<{ ok: true; registro: { fecha: string; peso: number } }>('/api/peso', { method: 'POST', body: { peso, fecha } }),
}
