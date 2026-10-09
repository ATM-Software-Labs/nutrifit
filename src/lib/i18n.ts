/** Diccionarios pequeños. Sin librería. La clave ausente cae al español. */
export type Idioma = 'es' | 'ca' | 'en'
export const IDIOMAS: Idioma[] = ['es', 'ca', 'en']
export const CLAVE_IDIOMA = 'nutrifit_lang'
const EVENTO = 'nf:idioma'

const DIC: Record<Idioma, Record<string, string>> = {
  es: {
    'nav.hoy': 'Hoy',
    'nav.historial': 'Historial',
    'nav.anadir': 'Añadir comida',
    'nav.peso': 'Peso',
    'nav.agua': 'Agua',
    'nav.perfil': 'Mi Perfil',
    'nav.ajustes': 'Ajustes',
    'nav.instalar': 'Instalar app',
    'nav.salir': 'Salir',
    'ajustes.titulo': 'Ajustes',
    'ajustes.idioma': 'Idioma',
    'ajustes.perfil': 'Perfil',
    'ajustes.apariencia': 'Apariencia',
    'login.google': 'Continuar con Google',
    'scan.analizando': 'Analizando foto...',
  },
  ca: {
    'nav.hoy': 'Avui',
    'nav.historial': 'Historial',
    'nav.anadir': 'Afegir menjar',
    'nav.peso': 'Pes',
    'nav.agua': 'Aigua',
    'nav.perfil': 'El meu perfil',
    'nav.ajustes': 'Ajustos',
    'nav.instalar': 'Instal·lar l\'app',
    'nav.salir': 'Sortir',
    'ajustes.titulo': 'Ajustos',
    'ajustes.idioma': 'Idioma',
    'ajustes.perfil': 'Perfil',
    'ajustes.apariencia': 'Aparença',
    'login.google': 'Continuar amb Google',
    'scan.analizando': 'Analitzant la foto...',
  },
  en: {
    'nav.hoy': 'Today',
    'nav.historial': 'History',
    'nav.anadir': 'Add food',
    'nav.peso': 'Weight',
    'nav.agua': 'Water',
    'nav.perfil': 'My profile',
    'nav.ajustes': 'Settings',
    'nav.instalar': 'Install app',
    'nav.salir': 'Log out',
    'ajustes.titulo': 'Settings',
    'ajustes.idioma': 'Language',
    'ajustes.perfil': 'Profile',
    'ajustes.apariencia': 'Appearance',
    'login.google': 'Continue with Google',
    'scan.analizando': 'Analyzing photo...',
  },
}

export function resolverIdioma(guardado: string | null | undefined, navegador: string | null | undefined): Idioma {
  if (guardado === 'es' || guardado === 'ca' || guardado === 'en') return guardado
  const tag = (navegador ?? '').toLowerCase()
  if (tag.startsWith('ca')) return 'ca'
  if (tag.startsWith('en')) return 'en'
  return 'es'
}

export function traducir(clave: string, idioma: Idioma): string {
  return DIC[idioma][clave] ?? DIC.es[clave] ?? clave
}

export function detectarIdioma(): Idioma {
  let guardado: string | null = null
  try {
    guardado = localStorage.getItem(CLAVE_IDIOMA)
  } catch {
    guardado = null
  }
  const nav = typeof navigator === 'undefined' ? 'es' : navigator.language
  return resolverIdioma(guardado, nav)
}

type Vista = {
  document?: { documentElement: { lang: string } }
  Event?: new (tipo: string) => unknown
  dispatchEvent?: (evento: unknown) => void
}

function vista(): Vista {
  return globalThis as Vista
}

export function iniciarIdioma() {
  const doc = vista().document
  if (!doc) return
  doc.documentElement.lang = detectarIdioma()
}

export function guardarIdioma(idioma: Idioma) {
  localStorage.setItem(CLAVE_IDIOMA, idioma)
  const v = vista()
  if (v.document) v.document.documentElement.lang = idioma
  if (v.dispatchEvent && v.Event) v.dispatchEvent(new v.Event(EVENTO))
}

export const eventoIdioma = EVENTO
