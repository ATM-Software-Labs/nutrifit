/**
 * Constantes públicas de despliegue (único sitio a tocar).
 * Se pueden sobrescribir en build con variables VITE_* (ver .env.example).
 */
import { unirApi, urlDeArchivo as mapearArchivo } from './urlApi.ts'

const env = import.meta.env

/** Repositorio de GitHub "propietario/nombre" (enlaces de código y descargas). */
export const GITHUB_REPO: string = env.VITE_GITHUB_REPO || 'ATM-Software-Labs/nutrifit'
export const URL_REPO = `https://github.com/${GITHUB_REPO}`
export const URL_PRIVACIDAD_REPO = `${URL_REPO}/blob/main/PRIVACIDAD.md`

/** PWA y App Links. No es la API: la cookie de sesión ya no vive en este host. */
export const URL_SITIO = 'https://nutri.trujillomingorance.com'

/**
 * Toda la red de la app (web y Android) sale por aquí.
 * Por defecto el gateway. En local, `VITE_API_URL=http://localhost:5173`
 * para que Vite reenvíe `/api` al Pages de 8788.
 */
let apiUrl = (env.VITE_API_URL || 'https://api.trujillomingorance.com/nutrifit').replace(/\/$/, '')
if (typeof location !== 'undefined' && location.origin === URL_SITIO) {
  apiUrl = ''
}
export const API_URL: string = apiUrl

/** Alias histórico. Los enlaces de la app usan `URL_SITIO`, no esta base. */
export const URL_API_NATIVA: string = API_URL

export const urlApi = (ruta: string): string => unirApi(API_URL, ruta)

export const urlDeArchivo = (valor: string): string => mapearArchivo(API_URL, valor)

/** sendBeacon solo sirve si la API es el mismo origen que la página. */
export function apiMismoOrigen(): boolean {
  if (typeof location === 'undefined') return false
  try {
    return new URL(API_URL || '/', location.href).origin === location.origin
  } catch {
    return false
  }
}

/** Meta diaria de agua (ml) del widget y del historial. */
export const META_AGUA_ML = 2500
