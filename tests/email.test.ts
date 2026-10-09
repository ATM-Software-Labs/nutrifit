import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  CABECERAS_CORREO,
  PIE_ACCESO,
  REMITENTE,
  RESPONDER_A,
  cuerpoBrevo,
  mensajeBienvenida,
  mensajeMagicLink,
  textoCaducidad,
} from '../functions/utils/email.ts'

const ENLACE = 'https://nutri.trujillomingorance.com/api/auth/verificar?token=abc&x=1'
const CODIGO = '048291'

test('el acceso usa la plantilla XHTML, el botón y el código de 6 cifras', () => {
  const m = mensajeMagicLink(ENLACE, CODIGO)
  assert.match(m.html, /^<!DOCTYPE html PUBLIC "-\/\/W3C\/\/DTD XHTML 1\.0 Transitional\/\/EN"/)
  assert.match(m.html, /<html lang="es" xml:lang="es" xmlns="http:\/\/www\.w3\.org\/1999\/xhtml">/)
  assert.match(m.html, /max-width:580px/)
  assert.match(m.html, /Has solicitado iniciar sesión en NutriFit\./)
  assert.match(
    m.html,
    /<a href="https:\/\/nutri\.trujillomingorance\.com\/api\/auth\/verificar\?token=abc&amp;x=1" style="background-color: #10b981; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">Acceder a mi cuenta<\/a>/,
  )
  assert.match(m.html, /font-size:32px;line-height:1\.2;font-weight:700;letter-spacing:6px/)
  assert.match(m.html, />048291</)
  assert.match(m.html, new RegExp(textoCaducidad().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.equal(m.html.includes('15 minutos'), false)
  assert.equal(m.asunto, '048291 es tu código de NutriFit')
})

test('el pie legal y el texto plano llevan los enlaces completos', () => {
  const m = mensajeMagicLink(ENLACE, CODIGO)
  assert.match(m.html, /Alberto Trujillo Mingorance \(Barcelona, España\)/)
  assert.match(m.html, /<meta http-equiv="Content-Language" content="es" \/>/)
  assert.match(m.html, /src="https:\/\/nutri\.trujillomingorance\.com\/logo\.svg"/)
  assert.match(m.html, /max-width:160px/)
  assert.match(m.html, /Correo transaccional de seguridad solicitado por el usuario/)
  assert.match(m.html, /Sin publicidad ni cookies comerciales/)
  assert.match(m.html, /https:\/\/nutri\.trujillomingorance\.com\/privacidad/)
  assert.match(m.html, /soporte@trujillomingorance\.com/)
  assert.match(m.html, /font-size:12px;line-height:1\.5/)
  assert.ok(m.texto.includes('Has solicitado iniciar sesión en NutriFit.'))
  assert.ok(m.texto.includes(ENLACE))
  assert.ok(m.texto.includes(CODIGO))
  assert.ok(m.texto.includes(PIE_ACCESO))
  assert.ok(m.texto.includes('https://nutri.trujillomingorance.com/privacidad'))
  assert.ok(m.texto.includes('https://nutri.trujillomingorance.com/ajustes'))
  assert.ok(m.texto.includes('soporte@trujillomingorance.com'))
})

test('Brevo recibe remitente, reply-to, textContent y cabeceras RFC 8058', () => {
  const m = mensajeMagicLink(ENLACE, CODIGO)
  const cuerpo = cuerpoBrevo({ para: 'ana@ejemplo.es', asunto: m.asunto, html: m.html, texto: m.texto })
  assert.deepEqual(cuerpo.sender, REMITENTE)
  assert.deepEqual(cuerpo.replyTo, RESPONDER_A)
  assert.equal(REMITENTE.email, 'nutrifit@trujillomingorance.com')
  assert.equal(RESPONDER_A.name, 'NutriFit Soporte')
  assert.equal(cuerpo.htmlContent, m.html)
  assert.equal(cuerpo.textContent, m.texto)
  assert.deepEqual(cuerpo.headers, CABECERAS_CORREO)
  assert.equal(CABECERAS_CORREO['Content-Language'], 'es')
  assert.equal(CABECERAS_CORREO['X-Auto-Response-Suppress'], 'All')
  assert.equal(CABECERAS_CORREO['List-Unsubscribe'], '<https://nutri.trujillomingorance.com/ajustes>')
  assert.equal(CABECERAS_CORREO['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click')
})

test('un nombre con HTML no se interpreta, y la bienvenida sigue siendo transaccional', () => {
  const m = mensajeBienvenida('<Ana>', { tmb: 1, tdee: 2, calorias: 2000, proteinas: 120, carbohidratos: 200, grasas: 60 })
  assert.match(m.html, /Hola, &lt;Ana&gt;/)
  assert.equal(m.html.includes('<Ana>'), false)
  assert.match(m.html, /No enviamos comunicaciones comerciales/)
  assert.ok(m.texto.includes('2000 kcal'))
  assert.ok(m.texto.includes('https://nutri.trujillomingorance.com/privacidad'))
})
