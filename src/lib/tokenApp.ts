/**
 * Token Bearer de la app Android, guardado con @capacitor/preferences
 * (SharedPreferences privadas de la app: no accesibles por otras apps sin root).
 * Alternativa más dura: un plugin respaldado por Android Keystore (p. ej.
 * capacitor-secure-storage-plugin / @aparajita/capacitor-secure-storage), ver docs/ANDROID.md.
 * El plugin se carga bajo demanda: en la web este módulo nunca se descarga.
 */
const CLAVE = 'nf_token_app'
let enMemoria: string | null | undefined

const prefs = () => import('@capacitor/preferences').then((m) => m.Preferences)

export async function obtenerTokenApp(): Promise<string | null> {
  if (enMemoria !== undefined) return enMemoria
  enMemoria = (await (await prefs()).get({ key: CLAVE })).value
  return enMemoria
}

export async function guardarTokenApp(token: string) {
  enMemoria = token
  await (await prefs()).set({ key: CLAVE, value: token })
}

export async function borrarTokenApp() {
  enMemoria = null
  await (await prefs()).remove({ key: CLAVE })
}
