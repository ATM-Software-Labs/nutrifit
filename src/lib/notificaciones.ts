import { LocalNotifications } from '@capacitor/local-notifications'
import { esNativa } from './plataforma.ts'

export async function solicitarPermisoNotificaciones() {
  if (esNativa) {
    try {
      const perm = await LocalNotifications.requestPermissions()
      return perm.display === 'granted'
    } catch {
      return false
    }
  } else {
    if (!('Notification' in window)) return false
    if (Notification.permission === 'granted') return true
    const perm = await Notification.requestPermission()
    return perm === 'granted'
  }
}

export async function programarNotificacionesDiarias() {
  const nivel = localStorage.getItem('nf:nivelNotificaciones') || 'medio' // 'bajo', 'medio', 'alto'
  
  if (esNativa) {
    const permitido = await solicitarPermisoNotificaciones()
    if (!permitido) return

    const pendientes = await LocalNotifications.getPending()
    if (pendientes.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pendientes.notifications })
    }

    const notificaciones = []

    if (nivel !== 'bajo') {
      const comidas = [
        { id: 101, titulo: '¡Hora de desayunar!', cuerpo: 'No te saltes la primera comida del día.', hora: 9 },
        { id: 102, titulo: '¡Hora de comer!', cuerpo: 'Registra tu comida para mantener tus macros bajo control.', hora: 14 },
        { id: 103, titulo: '¡Hora de cenar!', cuerpo: 'Una cena ligera ayuda a descansar mejor.', hora: 21 },
      ]
      for (const c of comidas) {
        notificaciones.push({
          id: c.id,
          title: c.titulo,
          body: c.cuerpo,
          schedule: { on: { hour: c.hora, minute: 0 }, allowWhileIdle: true },
        })
      }

      let idAgua = 200
      const intervaloAgua = nivel === 'alto' ? 1 : 2
      for (let hora = 9; hora <= 21; hora += intervaloAgua) {
        notificaciones.push({
          id: idAgua++,
          title: '¡Hora de hidratarse!',
          body: 'Recuerda beber al menos 250ml de agua.',
          schedule: { on: { hour: hora, minute: 30 }, allowWhileIdle: true },
        })
      }
    }

    if (notificaciones.length > 0) {
      await LocalNotifications.schedule({ notifications: notificaciones })
    }
  } else {
    // Para la web, no podemos usar LocalNotifications.
    // Simplemente programamos un temporizador en memoria si la pestaña está abierta.
    // (En un entorno real se usaría un Push API + Service Worker)
    const permitido = await solicitarPermisoNotificaciones()
    if (!permitido || nivel === 'bajo') return

    
    
    // Función simple para avisar cuando es hora, se comprueba cada minuto
    setInterval(() => {
      const d = new Date()
      const m = d.getMinutes()
      const h = d.getHours()
      const sec = d.getSeconds()
      
      // Solo lanzar en el primer segundo del minuto para no duplicar
      if (sec !== 0) return

      if (nivel !== 'bajo') {
        if (h === 9 && m === 0) new Notification('¡Hora de desayunar!', { body: 'No te saltes la primera comida del día.' })
        if (h === 14 && m === 0) new Notification('¡Hora de comer!', { body: 'Registra tu comida para mantener tus macros bajo control.' })
        if (h === 21 && m === 0) new Notification('¡Hora de cenar!', { body: 'Una cena ligera ayuda a descansar mejor.' })
        
        const intervaloAgua = nivel === 'alto' ? 1 : 2
        // If it's time for water: every 1 or 2 hours, at minute 30
        if (h >= 9 && h <= 21 && ((h - 9) % intervaloAgua === 0) && m === 30) {
          new Notification('¡Hora de hidratarse!', { body: 'Recuerda beber al menos 250ml de agua.' })
        }
      }
    }, 1000)
  }
}
