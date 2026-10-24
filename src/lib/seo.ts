/**
 * SEO por ruta en la SPA: título, descripción, canonical y robots.
 * Las páginas públicas se indexan; las de la app con sesión llevan noindex
 * (además de la cabecera X-Robots-Tag de public/_headers).
 */
const ORIGEN = 'https://nutri.trujillomingorance.com'

interface MetaRuta { titulo: string; descripcion: string; indexar: boolean }

const DESC_INICIO = 'NutriFit: cuenta calorías y macros con una foto, el código de barras o una frase. Agua, peso, ayuno y días de entreno. Gratis, sin anuncios y open source.'

const PUBLICAS: Record<string, MetaRuta> = {
  '/': { titulo: 'NutriFit | App gratis de calorías y macros con IA', descripcion: DESC_INICIO, indexar: true },
  '/privacidad': { titulo: 'Política de privacidad | NutriFit', descripcion: 'Qué datos guarda NutriFit, para qué, cuánto tiempo y cómo exportarlos o borrarlos. Sin anuncios ni venta de datos.', indexar: true },
  '/descargar': { titulo: 'Descargar NutriFit para Android y web | NutriFit', descripcion: 'Instala NutriFit en Android o como app web en cualquier móvil u ordenador. Gratis y sin anuncios.', indexar: true },
  '/recursos': { titulo: 'Recursos corporativos y legal | NutriFit', descripcion: 'Documentación legal, DPA y recursos corporativos de NutriFit.', indexar: true },
  '/legal': { titulo: 'Recursos corporativos y legal | NutriFit', descripcion: 'Documentación legal, DPA y recursos corporativos de NutriFit.', indexar: true },
}

const PRIVADAS: Record<string, string> = {
  '/historial': 'Historial', '/profile': 'Perfil', '/ajustes': 'Ajustes', '/peso': 'Peso',
  '/agua': 'Agua', '/logros': 'Logros', '/vincular': 'Vincular dispositivo', '/entrar': 'Entrar',
}

function meta(sel: string, crear: () => HTMLElement): HTMLElement {
  return document.head.querySelector<HTMLElement>(sel) ?? document.head.appendChild(crear())
}

/** `conSesion`: en «/» con sesión se muestra el diario (privado), sin ella el inicio público. */
export function aplicarSeo(ruta: string, conSesion: boolean): void {
  const r = ruta.replace(/\/+$/, '') || '/'
  const publica = PUBLICAS[r]
  const m: MetaRuta = publica && !(r === '/' && conSesion)
    ? publica
    : { titulo: `${PRIVADAS[r] ?? (r === '/' ? 'Hoy' : 'NutriFit')} | NutriFit`, descripcion: DESC_INICIO, indexar: false }
  document.title = m.titulo
  meta('meta[name="description"]', () => Object.assign(document.createElement('meta'), { name: 'description' })).setAttribute('content', m.descripcion)
  meta('meta[name="robots"]', () => Object.assign(document.createElement('meta'), { name: 'robots' })).setAttribute(
    'content',
    m.indexar ? 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1' : 'noindex, nofollow',
  )
  const url = ORIGEN + (r === '/' ? '/' : r)
  meta('link[rel="canonical"]', () => Object.assign(document.createElement('link'), { rel: 'canonical' })).setAttribute('href', url)
  document.head.querySelector('meta[property="og:url"]')?.setAttribute('content', url)
  document.head.querySelector('meta[property="og:title"]')?.setAttribute('content', m.titulo)
}
