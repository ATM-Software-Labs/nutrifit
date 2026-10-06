/**
 * Constantes públicas de despliegue (único sitio a tocar).
 * Se pueden sobrescribir en build con variables VITE_* (ver .env.example).
 */
const env = import.meta.env

/** Repositorio de GitHub "propietario/nombre" (enlaces de código y descargas). */
export const GITHUB_REPO: string = env.VITE_GITHUB_REPO || 'ATM-Software-Labs/nutrifit'
export const URL_REPO = `https://github.com/${GITHUB_REPO}`
/** Enlace estable al último APK publicado (el workflow sube siempre "NutriFit.apk"). */
export const URL_APK = `${URL_REPO}/releases/latest/download/NutriFit.apk`
export const URL_PRIVACIDAD_REPO = `${URL_REPO}/blob/main/PRIVACIDAD.md`

/** API de producción: la usa la app Android (su web corre en https://localhost). */
export const URL_API_NATIVA: string = (env.VITE_API_URL || 'https://nutri.trujillomingorance.com').replace(/\/$/, '')
