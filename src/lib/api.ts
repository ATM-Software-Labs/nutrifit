/**
 * Cliente de la API. Todas las rutas salen por `urlApi` hacia el gateway `/v1`.
 *  · Web: `credentials: include`. La cookie __Host-nf_session es del host del API.
 *  · App Android: `Authorization: Bearer` y sin cookies (localhost es cross-site).
 * Los errores se normalizan en ApiError.
 */
import { esNativa } from './plataforma.ts'
import { urlApi } from './config.ts'
import { borrarTokenApp, obtenerTokenApp } from './tokenApp.ts'
import { calcularMacros, type PlanMacros } from './macros.ts'
import { camposPerfil, hashContenido } from '../../functions/utils/contenidoHash.ts'
import { guardarHashSincronizado, leerHashSincronizado } from './hashSync.ts'
import { debeVolcar } from './ventanaCliente.ts'
import { guardarPesoLocal, olvidarPesoLocal } from './pesoLocal.ts'
import { hoy } from '../../functions/utils/fechas.ts'
import type { PlatoEscaneo } from './platoEscaneo.ts'
import { urlVisionPermitida } from '../../functions/utils/ticketVision.ts'
import { enviarVision, sha256Imagen, usarPasarelaVision, type PreparadoVision } from './visionGateway.ts'
import type { Comida, DatosPerfil, Historial, InfoVinculo, NuevaComida, ProductoOFF, Resumen, ResultadoAnalisis, Usuario } from './tipos.ts'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public codigo?: string,
    public detalles?: { campo: string; mensaje: string }[],
    public reintentarEn?: number,
    public errorCode?: string,
  ) {
    super(message)
    this.name = 'ApiError'
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
  /** Mantiene el POST vivo si la pestaña se cierra o pasa a segundo plano. */
  keepalive?: boolean
  /** Hash SHA-256 del contenido. Si el Worker ya lo tiene, responde 304. */
  ifNoneMatch?: string
  /** `alta` sube fuera de la ventana diaria. `normal` es el volcado diferido. */
  prioridad?: 'alta' | 'normal'
}

async function pedir<T>(ruta: string, o: Opciones = {}): Promise<T> {
  const res = await enviar(ruta, o, 'application/json')
  if (res.status === 304) return { ok: true, sinCambios: true } as T
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) await lanzar(res, data, o)
  return data as T
}

function leerCuerpoError(data: Record<string, unknown>): { code?: string; message?: string; retry?: number } {
  const anidado = data.error
  if (anidado && typeof anidado === 'object' && !Array.isArray(anidado)) {
    const o = anidado as Record<string, unknown>
    return {
      code: typeof o.code === 'string' ? o.code : undefined,
      message: typeof o.user_message === 'string' ? o.user_message : undefined,
      retry: typeof o.retry_after_seconds === 'number' ? o.retry_after_seconds : undefined,
    }
  }
  return {
    code: typeof data.error_code === 'string' ? data.error_code : undefined,
    message: typeof data.user_message === 'string' ? data.user_message : typeof data.error === 'string' ? data.error : undefined,
    retry: typeof data.reintentarEn === 'number' ? data.reintentarEn : undefined,
  }
}

async function lanzar(res: Response, data: Record<string, unknown>, o: Opciones): Promise<never> {
  const leido = leerCuerpoError(data)
  const errorCode = leido.code
  if (res.status === 401 && esNativa && (await obtenerTokenApp()) && errorCode !== 'AUTH_FAILURE') await borrarTokenApp()
  // Un 401 del proveedor de IA no es una sesión caducada. AUTH_FAILURE sale como 403.
  if (res.status === 401 && errorCode !== 'AUTH_FAILURE' && !o.silencio401) alPerderSesion?.()
  const reintentarEn = leido.retry ?? (typeof data.reintentarEn === 'number' ? data.reintentarEn : undefined)
  throw new ApiError(
    res.status,
    leido.message ?? 'Algo ha fallado. Inténtalo de nuevo.',
    data.codigo as string | undefined,
    data.detalles as ApiError['detalles'],
    reintentarEn,
    errorCode,
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
  if (o.ifNoneMatch) headers['if-none-match'] = `"${o.ifNoneMatch}"`
  if (o.prioridad) headers['x-sync-prioridad'] = o.prioridad
  const token = esNativa ? await obtenerTokenApp() : null
  if (token) headers.authorization = `Bearer ${token}`

  try {
    return await fetch(urlApi(ruta), {
      method: o.method ?? 'GET',
      headers,
      body,
      signal: o.signal,
      keepalive: o.keepalive,
      credentials: esNativa ? 'omit' : 'include',
      mode: 'cors',
    })
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
  entrarConCodigo: (email: string, codigo: string, turnstile: string) =>
    pedir<Entrada & { token?: string }>('/api/auth/codigo', {
      method: 'POST',
      body: { email, codigo, cliente: esNativa ? 'app' : 'web' },
      turnstile,
      silencio401: true,
    }),

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

  guardarPerfil: async (datos: DatosPerfil, turnstile: string) => {
    const plan = calcularMacros(datos)
    const hash = await hashContenido(
      camposPerfil({ ...datos, calorias: plan.calorias, proteinas: plan.proteinas, carbohidratos: plan.carbohidratos, grasas: plan.grasas }),
    )
    if (leerHashSincronizado('perfil') === hash) return { ok: true as const, sinCambios: true as const, usuario: null, plan }
    const res = await pedir<{ ok: true; usuario: Usuario | null; plan: PlanMacros; sinCambios?: boolean }>('/api/usuarios/perfil', {
      method: 'POST',
      body: datos,
      turnstile,
      ifNoneMatch: hash,
      prioridad: 'alta',
    })
    if (res.ok) guardarHashSincronizado('perfil', hash)
    if (res.sinCambios) return { ok: true as const, sinCambios: true as const, usuario: null, plan }
    return res
  },

  resumen: (fecha: string, signal?: AbortSignal) =>
    pedir<Resumen & { ok: true }>(`/api/comidas/resumen?fecha=${encodeURIComponent(fecha)}`, { signal }),
  guardarComida: (c: NuevaComida) => pedir<{ ok: true; comida: Comida }>('/api/comidas/guardar', { method: 'POST', body: c, prioridad: 'alta' }),
  borrarComida: (id: string) => pedir<{ ok: true }>(`/api/comidas/${encodeURIComponent(id)}`, { method: 'DELETE', prioridad: 'alta' }),
  analizar: (imagen: Blob, turnstile: string) => {
    const fd = new FormData()
    fd.append('imagen', imagen, imagen.type === 'image/webp' ? 'plato.webp' : 'plato.jpg')
    return pedir<{ ok: true; proveedor: 'gemini' | 'groq' | 'trujillo' | 'workers-ai'; resultado: ResultadoAnalisis }>('/api/comidas/analizar', {
      method: 'POST',
      body: fd,
      turnstile,
    })
  },
  /** Escáner unificado. En producción la foto sale hacia el API Gateway con un ticket de 60 s. */
  escanear: async (imagen: Blob, turnstile: string) => {
    if (!usarPasarelaVision()) {
      const fd = new FormData()
      fd.append('imagen', imagen, imagen.type === 'image/webp' ? 'plato.webp' : 'plato.jpg')
      return pedir<PlatoEscaneo>('/api/alimentos/escanear', { method: 'POST', body: fd, turnstile })
    }
    const prep = await pedir<PreparadoVision>('/api/alimentos/vision-ticket', {
      method: 'POST',
      body: { sha256: await sha256Imagen(imagen) },
      turnstile,
    })
    if (prep.modo === 'cache') return prep.plato
    if (prep.modo !== 'gateway' || !prep.ticket || !urlVisionPermitida(prep.url)) {
      throw new ApiError(504, 'La conexión tardó demasiado. Comprueba tu cobertura móvil y vuelve a pulsar.', 'upstream_timeout', undefined, 0, 'UPSTREAM_TIMEOUT')
    }
    let res: Response
    try {
      res = await enviarVision(prep.url, prep.ticket, imagen)
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e
      if ((e as Error).message === 'pasarela') {
        throw new ApiError(504, 'La conexión tardó demasiado. Comprueba tu cobertura móvil y vuelve a pulsar.', 'upstream_timeout', undefined, 0, 'UPSTREAM_TIMEOUT')
      }
      throw new ApiError(0, 'Sin conexión. Revisa tu red e inténtalo de nuevo.', 'red')
    }
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok) await lanzar(res, data, {})
    return data as unknown as PlatoEscaneo
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
  versionApp: () => pedir<{ ok: true; version: string | null; tamano: number | null; url: string }>('/api/app/version', { silencio401: true }),

  historial: (desde: string, hasta: string, signal?: AbortSignal) => pedir<{ ok: true } & Historial>(`/api/historial?${q({ desde, hasta })}`, { signal }),
  exportarCsv: (tipo: 'comidas' | 'peso' | 'agua', desde: string, hasta: string) => descargar(`/api/exportar?${q({ tipo, desde, hasta })}`),
  /** Volcado RGPD: perfil, diario, peso, agua y entrenamientos. */
  exportarDatos: () => descargar('/api/usuario/exportar-datos'),
  eliminarCuenta: () => pedir<{ ok: true }>('/api/usuario/eliminar-cuenta', { method: 'POST', body: { confirmar: 'ELIMINAR' } }),

  agua: async (fecha: string, ml: number, modo: 'sumar' | 'fijar' = 'sumar', keepalive = false) => {
    const total = modo === 'fijar' ? Math.max(0, Math.min(10000, Math.round(ml))) : null
    const hash = total === null ? null : await hashContenido({ fecha, ml: total })
    const clave = `agua:${fecha}`
    if (hash && leerHashSincronizado(clave) === hash) return { ok: true as const, fecha, ml: total as number }
    if (!(await debeVolcar('normal'))) return { ok: true as const, aplazado: true as const, fecha, ml: total ?? ml }
    const res = await pedir<{ ok: true; fecha: string; ml: number; sinCambios?: boolean; aplazado?: boolean }>('/api/agua', {
      method: 'POST',
      body: { fecha, ml, modo },
      keepalive,
      ifNoneMatch: hash ?? undefined,
      prioridad: 'normal',
    })
    if (res.aplazado) return { ok: true as const, aplazado: true as const, fecha, ml: total ?? ml }
    if (hash && res.ok) guardarHashSincronizado(clave, hash)
    if (res.sinCambios && total !== null) return { ok: true as const, fecha, ml: total }
    return res
  },

  pesos: (dias = 30) => pedir<{ ok: true; dias: number; registros: { fecha: string; peso: number }[] }>(`/api/peso?dias=${dias}`),
  registrarPeso: async (peso: number, fecha?: string, keepalive = false) => {
    const f = fecha ?? hoy()
    const hash = await hashContenido({ fecha: f, peso })
    const clave = `peso:${f}`
    if (leerHashSincronizado(clave) === hash) {
      olvidarPesoLocal(f)
      return { ok: true as const, sinCambios: true as const, registro: { fecha: f, peso } }
    }
    guardarPesoLocal(f, peso)
    if (!(await debeVolcar('normal'))) return { ok: true as const, aplazado: true as const, registro: { fecha: f, peso } }
    const res = await pedir<{ ok: true; registro: { fecha: string; peso: number }; sinCambios?: boolean; aplazado?: boolean }>('/api/peso', {
      method: 'POST',
      body: { peso, fecha: f },
      keepalive,
      ifNoneMatch: hash,
      prioridad: 'normal',
    })
    if (res.aplazado) return { ok: true as const, aplazado: true as const, registro: { fecha: f, peso } }
    if (res.ok) {
      guardarHashSincronizado(clave, hash)
      olvidarPesoLocal(f)
    }
    if (res.sinCambios) return { ok: true as const, sinCambios: true as const, registro: { fecha: f, peso } }
    return res
  },

  entrenamientos: (fecha?: string) =>
    pedir<{ ok: true; fecha: string; entrenamientos: { id: string; tipo: string; nombre: string | null; minutos: number | null; duracion_min: number | null; intensidad: string | null; calorias: number; origen: string | null; fecha: string }[] }>(
      `/api/entrenamientos${fecha ? `?${q({ fecha })}` : ''}`,
    ),
  entrenamientosRecientes: (limite = 12) =>
    pedir<{ ok: true; entrenamientos: { id: string; tipo: string; nombre: string | null; minutos: number | null; duracion_min: number | null; intensidad: string | null; calorias: number; origen: string | null; fecha: string }[] }>(
      `/api/entrenamientos?${q({ recientes: String(limite) })}`,
    ),
  guardarEntrenamiento: (datos: { tipo: string; nombre: string; minutos: number; duracion_min?: number; intensidad?: 'baja' | 'media' | 'alta'; calorias: number; fecha?: string }) =>
    pedir<{ ok: true; id: string; fecha: string }>('/api/entrenamientos', { method: 'POST', body: datos, prioridad: 'alta' }),
  borrarEntrenamiento: (id: string) => pedir<{ ok: true }>(`/api/entrenamientos/${encodeURIComponent(id)}`, { method: 'DELETE', prioridad: 'alta' }),
  guardarFrecuente: (datos: {
    tipo_comida: string
    nombre: string
    items?: { nombre: string; gramos?: number; calorias?: number; proteinas?: number; carbohidratos?: number; grasas?: number }[]
  }) => pedir<{ ok: true }>('/api/comidas/frecuentes', { method: 'POST', body: datos, prioridad: 'alta' }),
  amistades: () =>
    pedir<{ ok: true; amistades: { id: string; estado: string; creado_en: string; username: string | null; direccion: 'enviada' | 'recibida' }[] }>('/api/amistades'),
  solicitarAmistad: (username: string) => pedir<{ ok: true; id: string; estado: string }>('/api/amistades', { method: 'POST', body: { username } }),
  responderAmistad: (id: string, estado: 'aceptada' | 'rechazada') =>
    pedir<{ ok: true; id: string; estado: string }>(`/api/amistades/${encodeURIComponent(id)}`, { method: 'POST', body: { estado } }),
  borrarAmistad: (id: string) => pedir<{ ok: true }>(`/api/amistades/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  perfilPublico: (username: string) =>
    pedir<{ ok: true; perfil: { username: string; nombre: string | null; bio: string | null; avatar_url: string | null; banner_url: string | null } }>(
      `/api/usuarios/publico?${q({ username })}`,
    ),
  comunidad: (pagina = 1) =>
    pedir<{ ok: true; comunidad: { username: string; nombre: string | null; avatar_url: string | null }[]; pagina: number; hay_mas: boolean }>(
      `/api/usuarios/publico?${q({ pagina: String(pagina) })}`,
    ),
  sugerencias: () =>
    pedir<{ success: true; suggestions: { id: string; username: string; name: string | null; avatar_url: string | null; bio: string | null }[] }>(
      '/api/friends/suggestions',
    ),
  seguir: (targetUserId: string) =>
    pedir<{ success: true; id: string; status: 'pending' | 'accepted' }>('/api/friends/follow', { method: 'POST', body: { targetUserId } }),

  perfilSocial: () =>
    pedir<{ ok: true; perfil: { username: string | null; nombre: string | null; bio: string | null; avatar_url: string | null; banner_url: string | null; es_publico: number; meta_agua_base_ml: number } }>('/api/usuarios/social'),
  guardarPerfilSocial: (datos: { username?: string | null; bio?: string | null; es_publico?: 0 | 1 | boolean; meta_agua_base_ml?: number }) =>
    pedir<{ ok: true; perfil: { username: string | null; bio: string | null; es_publico: number; meta_agua_base_ml: number } }>('/api/usuarios/social', { method: 'POST', body: datos }),
  subirAvatar: (imagen: Blob) => {
    const fd = new FormData()
    fd.append('imagen', imagen, 'avatar')
    return pedir<{ ok: true; avatar_url: string }>('/api/usuarios/avatar', { method: 'POST', body: fd })
  },
  subirBanner: (imagen: Blob) => {
    const fd = new FormData()
    fd.append('imagen', imagen, 'banner')
    return pedir<{ ok: true; banner_url: string }>('/api/usuarios/banner', { method: 'POST', body: fd })
  },
  subirFotoPlato: (imagen: Blob) => {
    const fd = new FormData()
    fd.append('imagen', imagen, 'plato')
    return pedir<{ ok: true; id: string; imagen_url: string }>('/api/comidas/foto', { method: 'POST', body: fd })
  },

  integraciones: () => pedir<{ ok: true; integraciones: { proveedor: string; estado: string | null }[] }>('/api/integraciones', { silencio401: true }),
  dispositivos: () =>
    pedir<{ ok: true; dispositivos: { id: string; dispositivo?: string | null; navegador?: string | null; ip?: string | null; ultimo_acceso?: number | null }[] }>('/api/dispositivos'),
  cerrarDispositivo: (sesionId: string) => pedir<{ ok: true }>('/api/dispositivos', { method: 'DELETE', body: { sesionId } }),

  analizarMenu: (textoMenu: string) =>
    pedir<{ platos?: { nombre: string; calorias: number; proteinas: number; carbohidratos: number; grasas: number; recomendado: boolean; motivo: string }[] }>('/api/alimentos/analizar-menu', {
      method: 'POST',
      body: { textoMenu },
    }),
  barcodeEan: (ean: string) =>
    pedir<{ origen?: string; producto?: { id: string; nombre: string; marca: string; calorias: number; proteinas: number; carbohidratos: number; grasas: number; codigo_barras: string } }>(
      `/api/alimentos/barcode?ean=${encodeURIComponent(ean)}`,
    ),
}
