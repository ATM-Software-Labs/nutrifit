/**
 * ¿Web o app nativa (Capacitor)? En el APK la web se sirve desde
 * https://localhost, así que la API va con URL absoluta a producción y la
 * sesión viaja en `Authorization: Bearer` (no hay cookie de terceros).
 *
 * Se usa el `window.Capacitor` que el puente nativo inyecta ANTES de cargar la
 * página (mismo Capacitor.isNativePlatform() de @capacitor/core) para no meter
 * @capacitor/core (~3,5 KB gzip) en el bundle inicial de la web. Los plugins
 * nativos se cargan con import() dinámico solo dentro del APK.
 */
import { URL_API_NATIVA } from './config.ts'

type CapacitorGlobal = { isNativePlatform?: () => boolean }
const Capacitor = (globalThis as { Capacitor?: CapacitorGlobal }).Capacitor

export const esNativa = Capacitor?.isNativePlatform?.() === true
export const API_BASE = esNativa ? URL_API_NATIVA : ''
