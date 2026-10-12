/**
 * Recordatorios en el dispositivo.
 * · Web/PWA: los envía el servidor por Web Push (Worker nutrifit-cron) solo si la comida falta,
 *   así que aquí no se programa nada ni se pide permiso al arrancar.
 * · App Android: notificaciones locales de un solo uso para los próximos 7 días, con id por
 *   fecha y comida; al registrar una comida se cancela la de hoy.
 */
import { LocalNotifications } from '@capacitor/local-notifications'
import { esNativa } from './plataforma.ts'
import type { PrefRecordatorios } from './push.ts'

export async function solicitarPermisoNotificaciones() {
  if (esNativa) {
    try {
      return (await LocalNotifications.requestPermissions()).display === 'granted'
    } catch {
      return false
    }
  }
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  return (await Notification.requestPermission()) === 'granted'
}

const CLAVES = ['desayuno', 'comida', 'cena', 'snack', 'cierre'] as const
const TEXTO: Record<(typeof CLAVES)[number], [string, string]> = {
  desayuno: ['¿Qué has desayunado?', 'Apúntalo en 10 segundos y empieza el día con tu racha.'],
  comida: ['¿Ya has comido?', 'Haz una foto al plato o búscalo y sigue con tus macros al día.'],
  cena: ['Falta la cena', 'Regístrala ahora para cerrar bien el día.'],
  snack: ['¿Algo entre horas?', 'Si has picoteado, apúntalo para que cuadren tus calorías.'],
  cierre: ['Cierra tu día', 'Revisa lo que has comido hoy y mantén tu racha.'],
}

/** id estable: AAMMDD * 10 + índice de la comida (cabe en un int de Java). */
export function idNotificacion(fecha: Date, clave: (typeof CLAVES)[number]): number {
  const n = (fecha.getFullYear() % 100) * 10000 + (fecha.getMonth() + 1) * 100 + fecha.getDate()
  return n * 10 + CLAVES.indexOf(clave)
}

export async function programarRecordatoriosNativos(p: PrefRecordatorios, registradasHoy: string[] = []): Promise<void> {
  if (!esNativa) return
  const pendientes = await LocalNotifications.getPending()
  if (pendientes.notifications.length) await LocalNotifications.cancel({ notifications: pendientes.notifications })
  if (!p.activo || !(await solicitarPermisoNotificaciones())) return
  const ahora = new Date()
  const lista = []
  for (let d = 0; d < 7; d++) {
    for (const k of CLAVES) {
      const hhmm = p[k]
      if (!hhmm || (d === 0 && registradasHoy.includes(k))) continue
      const [h, m] = hhmm.split(':').map(Number)
      const at = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + d, h, m)
      if (at <= ahora) continue
      lista.push({ id: idNotificacion(at, k), title: TEXTO[k][0], body: TEXTO[k][1], schedule: { at, allowWhileIdle: true } })
    }
  }
  if (lista.length) await LocalNotifications.schedule({ notifications: lista })
}

/** Al registrar una comida en la app nativa: cancela el aviso de hoy de esa comida. */
export async function cancelarRecordatorioDeHoy(tipo: string): Promise<void> {
  if (!esNativa || !(CLAVES as readonly string[]).includes(tipo)) return
  await LocalNotifications.cancel({ notifications: [{ id: idNotificacion(new Date(), tipo as (typeof CLAVES)[number]) }] }).catch(() => {})
}

/** Arranque: en la app nativa reprograma con las preferencias del servidor. En web no hace nada. */
export async function programarNotificacionesDiarias(): Promise<void> {
  if (!esNativa) return
  try {
    const { leerRecordatorios } = await import('./push.ts')
    const r = await leerRecordatorios()
    await programarRecordatoriosNativos(r.preferencias)
  } catch {
    /* sin red o sin sesión: se reprograma en el siguiente arranque */
  }
}
