/**
 * ¿Web o app nativa (Capacitor)? La API, en los dos casos, es `API_URL`
 * (el gateway). La web manda la cookie `__Host-nf_session` de ese host.
 * El APK corre en https://localhost, así que no puede usar esa cookie:
 * la sesión viaja en `Authorization: Bearer`.
 *
 * Se usa el `window.Capacitor` que el puente nativo inyecta ANTES de cargar la
 * página (mismo Capacitor.isNativePlatform() de @capacitor/core) para no meter
 * @capacitor/core (~3,5 KB gzip) en el bundle inicial de la web. Los plugins
 * nativos se cargan con import() dinámico solo dentro del APK.
 */
import { API_URL } from './config.ts'

type CapacitorGlobal = { isNativePlatform?: () => boolean }
const Capacitor = (globalThis as { Capacitor?: CapacitorGlobal }).Capacitor

export const esNativa = Capacitor?.isNativePlatform?.() === true
export const API_BASE = API_URL || 'https://api.trujillomingorance.com/nutrifit'
