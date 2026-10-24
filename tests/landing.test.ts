import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { FAQ_LANDING } from '../src/lib/faqLanding.ts'
// @ts-expect-error módulo .mjs sin tipos
import { PAGINAS, paginaSeo } from '../scripts/paginas-seo.mjs'

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')

test('index.html: FAQPage JSON-LD coincide con las preguntas de la portada', () => {
  const m = html.match(/<script type="application\/ld\+json" id="ld-faq">([\s\S]*?)<\/script>/)
  assert.ok(m)
  const faq = JSON.parse(m[1])
  assert.equal(faq['@type'], 'FAQPage')
  assert.deepEqual(
    faq.mainEntity.map((q: { name: string; acceptedAnswer: { text: string } }) => [q.name, q.acceptedAnswer.text]),
    FAQ_LANDING.map((f) => [f.p, f.r]),
  )
})

test('index.html: vistas previas completas y absolutas', () => {
  for (const k of ['og:title', 'og:description', 'og:image', 'og:image:width', 'og:image:height', 'og:image:alt', 'og:url', 'og:site_name', 'og:locale'])
    assert.match(html, new RegExp(`<meta property="${k}" content="[^"]+"`), k)
  assert.match(html, /<meta name="twitter:card" content="summary_large_image"/)
  assert.match(html, /<meta property="og:image" content="https:\/\/nutri\.trujillomingorance\.com\/og\/inicio\.png"/)
  assert.match(html, /<meta property="og:locale" content="es_ES"/)
  assert.match(html, /"@type": "SoftwareApplication"|"SoftwareApplication"/)
  assert.match(html, /"@type": "Organization"/)
})

test('paginas-seo: cada ruta tiene su título, canonical e imagen y sin FAQPage', () => {
  for (const [ruta, p] of Object.entries(PAGINAS) as [string, { titulo: string; og: string; noindex?: boolean }][]) {
    const h: string = paginaSeo(html, ruta, p)
    assert.ok(h.includes(`<title>${p.titulo}</title>`), ruta)
    assert.ok(h.includes(`<link rel="canonical" href="https://nutri.trujillomingorance.com/${ruta}"`), ruta)
    assert.ok(h.includes(`<meta property="og:url" content="https://nutri.trujillomingorance.com/${ruta}"`), ruta)
    assert.ok(h.includes(`<meta property="og:image" content="https://nutri.trujillomingorance.com/og/${p.og}.png"`), ruta)
    assert.ok(h.includes(`<meta name="twitter:image" content="https://nutri.trujillomingorance.com/og/${p.og}.png"`), ruta)
    assert.ok(!h.includes('ld-faq'), ruta)
    if (p.noindex) assert.match(h, /<meta name="robots" content="noindex, nofollow"/)
  }
})

test('imágenes OG estáticas: PNG 1200×630 y < 300 KB', () => {
  for (const n of ['inicio', 'privacidad', 'descargar', 'legal', 'compartir']) {
    const b = readFileSync(new URL(`../public/og/${n}.png`, import.meta.url))
    assert.equal(b.subarray(1, 4).toString(), 'PNG', n)
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
    assert.equal(dv.getUint32(16), 1200, n)
    assert.equal(dv.getUint32(20), 630, n)
    assert.ok(b.length < 300 * 1024, n)
  }
})
