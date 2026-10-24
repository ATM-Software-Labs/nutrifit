/**
 * Tras `vite build`: copia dist/index.html a una página por ruta pública
 * (privacidad.html, descargar.html, legal.html, recursos.html, entrar.html) con su
 * título, descripción, canonical, og:* y twitter:* propios. Cloudflare Pages sirve
 * /privacidad desde privacidad.html, así los bots sin JS (WhatsApp, Telegram, Slack…)
 * ven la vista previa correcta sin Functions. El FAQPage solo va en la portada.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const ORIGEN = 'https://nutri.trujillomingorance.com'
export const PAGINAS = {
  privacidad: { titulo: 'Política de privacidad | NutriFit', desc: 'Qué datos guarda NutriFit, para qué, cuánto tiempo y cómo exportarlos o borrarlos. Fotos nunca guardadas, datos en la UE, sin anuncios.', og: 'privacidad', alt: 'Privacidad en NutriFit: fotos nunca guardadas y datos en la UE' },
  descargar: { titulo: 'Descargar NutriFit para Android, iPhone y ordenador | NutriFit', desc: 'Instala NutriFit en Android (APK o app web), iPhone o tu ordenador. Gratis, sin anuncios y open source.', og: 'descargar', alt: 'Descarga NutriFit en Android, iPhone y ordenador' },
  legal: { titulo: 'Recursos corporativos y legal | NutriFit', desc: 'Documentación legal, aviso legal, DPA y recursos corporativos de NutriFit.', og: 'legal', alt: 'Recursos legales de NutriFit' },
  recursos: { titulo: 'Recursos corporativos y legal | NutriFit', desc: 'Documentación legal, aviso legal, DPA y recursos corporativos de NutriFit.', og: 'legal', alt: 'Recursos legales de NutriFit' },
  entrar: { titulo: 'Entrar | NutriFit', desc: 'Entra en NutriFit con tu email, sin contraseña.', og: 'inicio', alt: 'NutriFit, tu nutrición en equilibrio', noindex: true },
}

const escA = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
function setMeta(html, attr, clave, valor) {
  const re = new RegExp(`(<meta ${attr}="${clave.replace(/[.:]/g, (c) => `\\${c}`)}" content=")[^"]*(")`)
  if (!re.test(html)) throw new Error(`falta ${attr}=${clave}`)
  return html.replace(re, `$1${escA(valor)}$2`)
}

export function paginaSeo(base, ruta, p) {
  const url = `${ORIGEN}/${ruta}`
  const img = `${ORIGEN}/og/${p.og}.png`
  let h = base.replace(/<title>[^<]*<\/title>/, `<title>${escA(p.titulo)}</title>`)
  h = h.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`)
  h = setMeta(h, 'name', 'description', p.desc)
  for (const [k, v] of [['og:title', p.titulo], ['og:description', p.desc], ['og:url', url], ['og:image', img], ['og:image:alt', p.alt]]) h = setMeta(h, 'property', k, v)
  for (const [k, v] of [['twitter:title', p.titulo], ['twitter:description', p.desc], ['twitter:image', img], ['twitter:image:alt', p.alt]]) h = setMeta(h, 'name', k, v)
  if (p.noindex) h = setMeta(h, 'name', 'robots', 'noindex, nofollow')
  h = h.replace(/\s*<!-- Preguntas de la portada[^>]*-->\s*<script type="application\/ld\+json" id="ld-faq">[\s\S]*?<\/script>/, '')
  return h
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const base = readFileSync('dist/index.html', 'utf8')
  for (const [ruta, p] of Object.entries(PAGINAS)) writeFileSync(`dist/${ruta}.html`, paginaSeo(base, ruta, p))
  console.log(`páginas SEO: ${Object.keys(PAGINAS).map((r) => `/${r}`).join(' ')}`)
}
