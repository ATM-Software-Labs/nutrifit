import test from 'node:test'
import assert from 'node:assert/strict'
import {
  aplicarPrivacidad, construirDia, descripcionDia, estadoEnlace, expiraEn, fechaTexto, leerDia, nuevoToken,
  paginaDia, paginaNoDisponible, PRIVACIDAD_POR_DEFECTO, textoDia, TOKEN_RE, validarPngOg,
} from '../functions/utils/compartir.ts'
import { tocaAvisoCompartir } from '../src/lib/avisoCompartir.ts'

const fila = (tipo: string, descripcion: string, calorias: number, emoji: string | null = null) => ({ tipo_comida: tipo, descripcion, calorias, proteinas: 10, carbohidratos: 20, grasas: 5, emoji })
const dia = () => construirDia({
  fecha: '2026-10-24',
  nombre: 'Alberto Trujillo',
  filas: [fila('desayuno', 'Café con leche', 120, '☕'), fila('desayuno', 'Tostada <b>', 200, '🍞'), fila('cena', 'Salmón', 500, '🐟')],
  nombresTipo: { cena: 'Cenita' },
  metaKcal: 2100, metaMacros: { proteinas: 150, carbohidratos: 220, grasas: 70 },
  aguaMl: 1500, metaAguaMl: 2000, pesoKg: 78.4, racha: 12,
  logros: [{ titulo: 'Racha de 10', icono: 'racha' }],
})

test('construirDia agrupa por tipo, suma totales y respeta nombres de comida', () => {
  const d = dia()
  assert.deepEqual(d.grupos.map((g) => g.tipo), ['desayuno', 'cena'])
  assert.equal(d.grupos[1]!.nombre, 'Cenita')
  assert.equal(d.kcal, 820)
  assert.equal(d.macros.proteinas, 30)
  assert.equal(d.grupos[0]!.items[0]!.emoji, '☕')
  assert.equal(d.racha, 12)
  assert.equal(d.logros.length, 1)
})

test('privacidad: por defecto oculta el nombre; kcal, peso/racha y solo emojis', () => {
  const d = dia()
  assert.equal(aplicarPrivacidad(d, PRIVACIDAD_POR_DEFECTO).nombre, undefined)
  assert.equal(aplicarPrivacidad(d, { ...PRIVACIDAD_POR_DEFECTO, mostrarNombre: true }).nombre, 'Alberto')
  const sinKcal = aplicarPrivacidad(d, { ...PRIVACIDAD_POR_DEFECTO, ocultarKcal: true })
  assert.equal(sinKcal.kcal, undefined)
  assert.equal(sinKcal.metaKcal, undefined)
  assert.ok(sinKcal.grupos.every((g) => g.kcal === undefined && g.items.every((i) => i.kcal === undefined)))
  assert.doesNotMatch(textoDia(sinKcal), /kcal/)
  const sinPeso = aplicarPrivacidad(d, { ...PRIVACIDAD_POR_DEFECTO, ocultarPesoRacha: true })
  assert.equal(sinPeso.pesoKg, undefined)
  assert.equal(sinPeso.racha, undefined)
  assert.doesNotMatch(textoDia(sinPeso), /🔥|⚖️/)
  const emojis = aplicarPrivacidad(d, { ...PRIVACIDAD_POR_DEFECTO, soloEmojis: true })
  assert.ok(emojis.grupos.every((g) => g.items.every((i) => i.nombre === undefined)))
  assert.doesNotMatch(textoDia(emojis), /Salmón|Café/)
  assert.equal(d.pesoKg, 78.4, 'no muta el original')
})

test('texto con emojis para pegar', () => {
  const t = textoDia(aplicarPrivacidad(dia(), PRIVACIDAD_POR_DEFECTO), 'https://x.test/d/abc')
  assert.match(t, /^🌱 Mi día en NutriFit · sábado, 24 de octubre/)
  assert.match(t, /☕ Desayuno · 320 kcal/)
  assert.match(t, /🐟 Salmón \(500 kcal\)/)
  assert.match(t, /820 \/ 2\.100 kcal/)
  assert.match(t, /💧 1,5 L de 2 L/)
  assert.match(t, /🔥 Racha de 12 días/)
  assert.match(t, /https:\/\/x\.test\/d\/abc$/)
  assert.ok(descripcionDia(dia()).length <= 200)
  assert.equal(fechaTexto('2026-01-01'), 'jueves, 1 de enero de 2026')
})

test('tokens aleatorios de 22 caracteres base64url', () => {
  const a = nuevoToken(), b = nuevoToken()
  assert.match(a, TOKEN_RE)
  assert.notEqual(a, b)
  assert.doesNotMatch('../../etc', TOKEN_RE)
})

test('caducidad y estado del enlace', () => {
  const ahora = new Date('2026-10-24T20:00:00Z')
  assert.equal(expiraEn('7d', ahora), '2026-10-31T20:00:00.000Z')
  assert.equal(expiraEn('nunca', ahora), null)
  assert.equal(estadoEnlace({ expira_en: '2026-10-31T20:00:00.000Z', revocado_en: null }, ahora), 'activo')
  assert.equal(estadoEnlace({ expira_en: '2026-10-24T19:00:00.000Z', revocado_en: null }, ahora), 'caducado')
  assert.equal(estadoEnlace({ expira_en: null, revocado_en: '2026-10-24T10:00:00Z' }, ahora), 'revocado')
})

function pngCabecera(w: number, h: number, extra = 0) {
  const b = new Uint8Array(33 + extra)
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52])
  const dv = new DataView(b.buffer)
  dv.setUint32(16, w); dv.setUint32(20, h)
  return b
}
test('PNG de la vista previa: 1200×630 y < 300 KB', () => {
  assert.ok(validarPngOg(pngCabecera(1200, 630)))
  assert.ok(!validarPngOg(pngCabecera(1080, 1080)))
  assert.ok(!validarPngOg(pngCabecera(1200, 630, 300 * 1024)))
  const jpeg = pngCabecera(1200, 630); jpeg[0] = 0xff
  assert.ok(!validarPngOg(jpeg))
})

test('página pública: metadatos OG/Twitter absolutos, noindex y HTML escapado', () => {
  const d = aplicarPrivacidad(dia(), PRIVACIDAD_POR_DEFECTO)
  const url = 'https://nutri.trujillomingorance.com/d/AAAAAAAAAAAAAAAAAAAAAA'
  const html = paginaDia(d, { url, imagen: `${url}/og.png`, origen: 'https://nutri.trujillomingorance.com' })
  for (const re of [
    /<meta property="og:title" content="[^"]+"/, /<meta property="og:description" content="[^"]+"/,
    new RegExp(`<meta property="og:image" content="${url}/og.png"`), /og:image:width" content="1200"/, /og:image:height" content="630"/,
    /og:image:alt" content="[^"]+"/, new RegExp(`og:url" content="${url}"`), /og:site_name" content="NutriFit"/, /og:locale" content="es_ES"/,
    /twitter:card" content="summary_large_image"/, /<meta name="robots" content="noindex/, /theme-color" content="#10B981"/i, /<html lang="es"/,
  ]) assert.match(html, re)
  assert.doesNotMatch(html, /Tostada <b>/)
  assert.match(html, /Tostada &lt;b&gt;/)
  assert.doesNotMatch(html, /Alberto/)
  assert.doesNotMatch(html, /<script/)
  const no = paginaNoDisponible('https://nutri.trujillomingorance.com', 'caducado')
  assert.match(no, /og:image" content="https:\/\/nutri\.trujillomingorance\.com\/og\/compartir\.png"/)
  assert.match(no, /noindex/)
})

test('leerDia descarta JSON corrupto', () => {
  assert.equal(leerDia('{'), null)
  assert.equal(leerDia('{"x":1}'), null)
  assert.equal(leerDia(JSON.stringify(dia()))?.fecha, '2026-10-24')
})

test('aviso de compartir: solo por la tarde, con comidas, canal app activo y una vez', () => {
  const base = { ahora: new Date(2026, 9, 24, 21, 45), numComidas: 3, cierre: '22:30', canalApp: true, descartado: false }
  assert.ok(tocaAvisoCompartir(base))
  assert.ok(!tocaAvisoCompartir({ ...base, ahora: new Date(2026, 9, 24, 21, 0) }))
  assert.ok(!tocaAvisoCompartir({ ...base, numComidas: 0 }))
  assert.ok(!tocaAvisoCompartir({ ...base, canalApp: false }))
  assert.ok(!tocaAvisoCompartir({ ...base, descartado: true }))
  assert.ok(tocaAvisoCompartir({ ...base, cierre: null, ahora: new Date(2026, 9, 24, 21, 0) }))
})
