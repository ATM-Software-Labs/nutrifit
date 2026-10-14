import { pedirApi } from './api.ts'

export interface PrefRecordatorios {
  activo: boolean
  zona: string
  desayuno: string | null
  comida: string | null
  cena: string | null
  snack: string | null
  cierre: string | null
  agua: boolean
  email: boolean
  resumen_semanal: boolean
  silencio_desde: string
  silencio_hasta: string
  max_dia: number
  canales?: Record<string, { push: boolean; email: boolean; app: boolean }>
}
export interface EstadoRecordatorios {
  preferencias: PrefRecordatorios
  dispositivosPush: number
  vapidPublica: string | null
  pushDisponible: boolean
}

export const pushSoportado = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

function claveBytes(b64: string): Uint8Array {
  const p = b64.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64.length + 3) % 4)
  return Uint8Array.from(atob(p), (c) => c.charCodeAt(0))
}

/** Pide permiso, se suscribe con la clave VAPID y guarda la suscripción en el servidor. */
export async function activarPush(vapidPublica: string): Promise<'ok' | 'denegado' | 'no-soportado'> {
  if (!pushSoportado()) return 'no-soportado'
  const permiso = await Notification.requestPermission()
  if (permiso !== 'granted') return 'denegado'
  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: claveBytes(vapidPublica) as BufferSource })
  await pedirApi('/api/push/suscripcion', { method: 'POST', body: sub.toJSON() })
  return 'ok'
}

function mismaClave(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a) return false
  const x = new Uint8Array(a)
  return x.length === b.length && x.every((v, i) => v === b[i])
}

/**
 * Si la clave VAPID del servidor cambió (rotación), la suscripción del navegador ya no sirve:
 * se da de baja y se vuelve a suscribir sin preguntar (el permiso ya está concedido) y se avisa al servidor.
 * Con la misma clave, refresca la suscripción en el servidor una vez al día.
 */
export async function resincronizarPush(): Promise<'renovada' | 'refrescada' | 'nada'> {
  if (!pushSoportado() || Notification.permission !== 'granted') return 'nada'
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return 'nada'
  const { vapidPublica } = await leerRecordatorios()
  if (!vapidPublica) return 'nada'
  const clave = claveBytes(vapidPublica)
  if (mismaClave(sub.options.applicationServerKey, clave)) {
    const hoy = new Date().toISOString().slice(0, 10)
    if (localStorage.getItem('nf:push_refrescado') === hoy) return 'nada'
    await pedirApi('/api/push/suscripcion', { method: 'PATCH', body: sub.toJSON() })
    localStorage.setItem('nf:push_refrescado', hoy)
    return 'refrescada'
  }
  const anterior = sub.endpoint
  await sub.unsubscribe().catch(() => {})
  const nueva = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: clave as BufferSource })
  await pedirApi('/api/push/suscripcion', { method: 'PATCH', body: { ...nueva.toJSON(), anterior } })
  return 'renovada'
}

export async function desactivarPush(): Promise<void> {
  if (!pushSoportado()) return
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  await pedirApi('/api/push/suscripcion', { method: 'DELETE', body: { endpoint: sub.endpoint } }).catch(() => {})
  await sub.unsubscribe().catch(() => {})
}

export const leerRecordatorios = () => pedirApi<EstadoRecordatorios>('/api/recordatorios')
export const guardarRecordatorios = (p: PrefRecordatorios) => pedirApi<EstadoRecordatorios>('/api/recordatorios', { method: 'PUT', body: p })
export const probarPush = () => pedirApi<{ enviados: number; dispositivos: number }>('/api/push/prueba', { method: 'POST', body: {} })
