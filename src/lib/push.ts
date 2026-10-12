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
