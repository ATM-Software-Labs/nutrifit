/**
 * Plataforma del dispositivo e instalación de la app:
 *  · detectarPlataforma(): android | ios | escritorio (userAgentData si existe;
 *    iPadOS 13+ se anuncia como Mac y lo delata la pantalla táctil).
 *  · instalada(): la PWA ya corre como app (display-mode standalone).
 *  · promptInstalar(): evento beforeinstallprompt capturado lo antes posible
 *    (Chrome/Edge en Android y escritorio). iOS no lo tiene: pasos a mano.
 */
import { esNativa } from './plataforma.ts'

export { detectarPlataforma, type Plataforma } from './dispositivo.ts'

export const instalada = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

/** ¿Tiene sentido ofrecer descargar/instalar? (no dentro del APK ni de la PWA instalada) */
export const ofrecerDescarga = () => !esNativa && !instalada()

export interface EventoInstalar extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let eventoGuardado: EventoInstalar | null = null
const oyentes = new Set<(e: EventoInstalar | null) => void>()

/** Se llama al arrancar (main.tsx): el evento llega una sola vez y muy pronto. */
export function capturarPromptInstalar() {
  if (esNativa) return
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    eventoGuardado = e as EventoInstalar
    oyentes.forEach((f) => f(eventoGuardado))
  })
  window.addEventListener('appinstalled', () => {
    eventoGuardado = null
    oyentes.forEach((f) => f(null))
  })
}

export const promptInstalar = () => eventoGuardado
export function alCambiarPrompt(f: (e: EventoInstalar | null) => void) {
  oyentes.add(f)
  return () => void oyentes.delete(f)
}

/**
 * Texto cuando el navegador no entrega `beforeinstallprompt`
 * (Safari/iOS, ya instalada, o Chrome sin el evento).
 */
export const MENSAJE_INSTALAR_MANUAL =
  "Para instalar NutriFit, abre el menú del navegador y selecciona 'Añadir a la pantalla de inicio'."

/** Lanza el diálogo nativo de instalación. Devuelve false si no está disponible. */
export async function instalarPWA(): Promise<boolean> {
  const e = eventoGuardado
  if (!e) return false
  await e.prompt()
  const { outcome } = await e.userChoice
  if (outcome === 'accepted') eventoGuardado = null
  return true
}

export const URL_DESCARGAR = 'https://nutri.trujillomingorance.com/descargar'
