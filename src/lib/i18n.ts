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
    'ajustes.dispositivos': 'Dispositivos y Seguridad',
    'ajustes.conexiones': 'Conexiones y Wearables',
    'ajustes.estrategia': 'Estrategia y Ayuno',
    'ajustes.mas': 'Más',
    'ajustes.cuenta': 'Cuenta',
    'ajustes.instalar': 'Instalar la app',
    'ajustes.privacidad': 'Política de Privacidad',
    'ajustes.codigo': 'Código abierto en GitHub',
    'ajustes.sesion': 'Sesión iniciada como',
    'ajustes.descargar': 'Descargar mis datos',
    'ajustes.cerrar': 'Cerrar sesión',
    'ajustes.eliminar': 'Eliminar mi cuenta',
    'ajustes.guardar': 'Guardar cambios',
    'ajustes.nombre': 'Nombre',
    'ajustes.sexo': 'Sexo',
    'ajustes.hombre': 'Hombre',
    'ajustes.mujer': 'Mujer',
    'ajustes.edad': 'Edad',
    'ajustes.peso': 'Peso',
    'ajustes.altura': 'Altura',
    'ajustes.actividad': 'Actividad',
    'ajustes.objetivo': 'Objetivo',
    'ajustes.peso_objetivo': 'Peso objetivo',
    'ajustes.peso_hint': 'Se muestra como línea discontinua en la gráfica de peso.',
    'ajustes.dudas': '¿Dudas?',
    'ajustes.completa_datos': 'Completa los datos para ver tus objetivos',
    'ajustes.tema': 'Tema',
    'ajustes.sistema': 'Sistema',
    'ajustes.claro': 'Claro',
    'ajustes.oscuro': 'Oscuro',
    'login.google': 'Continuar con Google',
    'scan.analizando': 'Analizando foto...',
    'scan.comprimiendo': 'Comprimiendo imagen...',
    'scan.macros': 'Analizando macros...',
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
    'ajustes.dispositivos': 'Dispositius i Seguretat',
    'ajustes.conexiones': 'Connexions i Wearables',
    'ajustes.estrategia': 'Estratègia i Dejuni',
    'ajustes.mas': 'Més',
    'ajustes.cuenta': 'Compte',
    'ajustes.instalar': 'Instal·lar l\'app',
    'ajustes.privacidad': 'Política de Privacitat',
    'ajustes.codigo': 'Codi obert a GitHub',
    'ajustes.sesion': 'Sessió iniciada com',
    'ajustes.descargar': 'Descarregar les meves dades',
    'ajustes.cerrar': 'Tancar sessió',
    'ajustes.eliminar': 'Eliminar el meu compte',
    'ajustes.guardar': 'Desar canvis',
    'ajustes.nombre': 'Nom',
    'ajustes.sexo': 'Sexe',
    'ajustes.hombre': 'Home',
    'ajustes.mujer': 'Dona',
    'ajustes.edad': 'Edat',
    'ajustes.peso': 'Pes',
    'ajustes.altura': 'Alçada',
    'ajustes.actividad': 'Activitat',
    'ajustes.objetivo': 'Objectiu',
    'ajustes.peso_objetivo': 'Pes objectiu',
    'ajustes.peso_hint': 'Es mostra com a línia discontínua a la gràfica de pes.',
    'ajustes.dudas': 'Dubtes?',
    'ajustes.completa_datos': 'Completa les dades per veure els objectius',
    'ajustes.tema': 'Tema',
    'ajustes.sistema': 'Sistema',
    'ajustes.claro': 'Clar',
    'ajustes.oscuro': 'Fosc',
    'login.google': 'Continuar amb Google',
    'scan.analizando': 'Analitzant la foto...',
    'scan.comprimiendo': 'Comprimint la imatge...',
    'scan.macros': 'Analitzant els macros...',
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
    'ajustes.dispositivos': 'Devices & Security',
    'ajustes.conexiones': 'Connections & Wearables',
    'ajustes.estrategia': 'Strategy & Fasting',
    'ajustes.mas': 'More',
    'ajustes.cuenta': 'Account',
    'ajustes.instalar': 'Install app',
    'ajustes.privacidad': 'Privacy Policy',
    'ajustes.codigo': 'Open source on GitHub',
    'ajustes.sesion': 'Logged in as',
    'ajustes.descargar': 'Download my data',
    'ajustes.cerrar': 'Log out',
    'ajustes.eliminar': 'Delete my account',
    'ajustes.guardar': 'Save changes',
    'ajustes.nombre': 'Name',
    'ajustes.sexo': 'Sex',
    'ajustes.hombre': 'Male',
    'ajustes.mujer': 'Female',
    'ajustes.edad': 'Age',
    'ajustes.peso': 'Weight',
    'ajustes.altura': 'Height',
    'ajustes.actividad': 'Activity',
    'ajustes.objetivo': 'Goal',
    'ajustes.peso_objetivo': 'Goal weight',
    'ajustes.peso_hint': 'Shown as a dashed line on the weight chart.',
    'ajustes.dudas': 'Questions?',
    'ajustes.completa_datos': 'Complete data to see your goals',
    'ajustes.tema': 'Theme',
    'ajustes.sistema': 'System',
    'ajustes.claro': 'Light',
    'ajustes.oscuro': 'Dark',
    'login.google': 'Continue with Google',
    'scan.analizando': 'Analyzing photo...',
    'scan.comprimiendo': 'Compressing image...',
    'scan.macros': 'Analyzing macros...',
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
