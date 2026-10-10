/**
 * Correos transaccionales de NutriFit vía Brevo (REST v3).
 * Sin dependencias: el HTML va con CSS en línea y la parte de texto
 * viaja en el mismo envío (multipart/alternative lo arma Brevo).
 * Un fallo de red no se propaga al handler: se anota y se devuelve false.
 */
import type { Env } from './env.ts'
import type { PlanMacros } from '../../src/lib/macros.ts'
import { DURACION_MAGIC } from './magicLink.ts'

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email'

export const REMITENTE = { name: 'NutriFit', email: 'nutrifit@trujillomingorance.com' } as const
export const RESPONDER_A = { name: 'NutriFit Soporte', email: 'soporte@trujillomingorance.com' } as const

const URL_APP = 'https://nutri.trujillomingorance.com'
const URL_PRIVACIDAD = `${URL_APP}/privacidad`
const URL_AJUSTES = `${URL_APP}/ajustes`

/**
 * Cabeceras del mensaje (no de la petición a la API). Brevo las copia al MIME.
 * List-Unsubscribe-Post sigue el RFC 8058: el cliente hace POST al HTTPS de List-Unsubscribe.
 */
export const CABECERAS_CORREO = {
  'Content-Language': 'es',
  'X-Auto-Response-Suppress': 'All',
  'List-Unsubscribe': `<${URL_AJUSTES}>`,
  'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
} as const

const MINT = '#10b981'
const FUENTE = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Courier New', monospace"

/** Segundos de validez del enlace y del código (hoy 4 horas, misma constante que el token). */
export function textoCaducidad(segundos = DURACION_MAGIC): string {
  if (segundos % 3600 === 0) {
    const horas = segundos / 3600
    return horas === 1 ? '1 hora' : `${horas} horas`
  }
  const minutos = Math.round(segundos / 60)
  return minutos === 1 ? '1 minuto' : `${minutos} minutos`
}

export function escaparHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

function hrefSeguro(enlace: string): string {
  return /^https?:\/\//i.test(enlace) ? escaparHtml(enlace) : '#'
}

const AVISO_SEGURIDAD = (caduca: string) =>
  `Este código caduca en ${caduca} y es de un solo uso. Si no has sido tú, puedes ignorar este correo de forma segura; nadie puede acceder sin este enlace.`

const FRASE_NO_COMERCIAL =
  'No enviamos comunicaciones comerciales ni publicidad sin tu consentimiento expreso.'

const DERECHOS =
  `Tus derechos: Conforme al RGPD y la LOPDGDD, puedes consultar nuestra Política de Privacidad (${URL_PRIVACIDAD}), descargar tus datos o solicitar la baja y supresión íntegra de tu cuenta desde Ajustes en la app o contactando a ${RESPONDER_A.email}.`

/** Pie del correo de acceso. La segunda frase solo es cierta en ese envío. */
export const PIE_ACCESO =
  `NutriFit · Proyecto titularidad de Alberto Trujillo Mingorance (Barcelona, España).\n` +
  `Correo transaccional de seguridad solicitado por el usuario. Sin publicidad ni cookies comerciales.\n\n` +
  DERECHOS

const PIE_CUENTA =
  `NutriFit · Proyecto titularidad de Alberto Trujillo Mingorance (Barcelona, España).\n` +
  `Este es un correo transaccional sobre la configuración de tu cuenta. ${FRASE_NO_COMERCIAL}\n\n` +
  DERECHOS

function pieHtml(texto: string): string {
  const html = escaparHtml(texto)
    .replaceAll(URL_PRIVACIDAD, `<a href="${URL_PRIVACIDAD}" style="color:#6b7280;text-decoration:underline;">${URL_PRIVACIDAD}</a>`)
    .replaceAll(RESPONDER_A.email, `<a href="mailto:${RESPONDER_A.email}" style="color:#6b7280;text-decoration:underline;">${RESPONDER_A.email}</a>`)
    .replaceAll('\n\n', '<br /><br />')
    .replaceAll('\n', '<br />')
  return `<tr><td class="nf-suave" style="padding-top:36px;font-size:11px;line-height:1.5;color:#6b7280;">${html}<br /><br /><a href="${URL_AJUSTES}" style="color:#6b7280;text-decoration:underline;">Ajustes</a></td></tr>`
}

function envolver(cuerpo: string, preheader: string, jsonLd?: string): string {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html lang="es" xml:lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta http-equiv="Content-Language" content="es" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<title>NutriFit</title>
<style type="text/css">
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  @media (prefers-color-scheme: dark) {
    .nf-body, .nf-fondo { background-color: #09090b !important; }
    .nf-tarjeta { background-color: #18181b !important; }
    .nf-texto { color: #f4f4f5 !important; }
    .nf-suave { color: #a1a1aa !important; }
    .nf-codigo { background-color: #27272a !important; color: #fafafa !important; border-color: #3f3f46 !important; }
  }
</style>
${jsonLd || ''}
</head>
<body class="nf-body" style="margin:0;padding:0;background-color:#f6f8fa;font-family:${FUENTE};color:#111827;">
<span style="display:none;font-size:1px;color:#f6f8fa;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${escaparHtml(preheader)}</span>
<table role="presentation" class="nf-fondo" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f6f8fa" style="background-color:#f6f8fa;">
<tr><td align="center" style="padding:48px 16px;">
<table role="presentation" class="nf-tarjeta" width="480" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="width:100%;max-width:480px;background-color:#ffffff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.04);">
<tr><td align="center" style="padding:40px 32px 16px;font-family:${FUENTE};">
<img src="${URL_APP}/logo.png" alt="NutriFit Logo" width="64" height="64" style="display:inline-block;width:64px;height:auto;vertical-align:middle;border:0;outline:none;text-decoration:none;" />
<div style="margin-top:16px;font-size:24px;font-weight:700;letter-spacing:-0.3px;color:${MINT};">NutriFit</div>
</td></tr>
${cuerpo}
</table>
</td></tr></table>
</body>
</html>`
}

export interface MensajeCorreo {
  asunto: string
  html: string
  texto: string
}

export function mensajeMagicLink(enlace: string, codigo?: string): MensajeCorreo {
  const caduca = textoCaducidad()
  const aviso = AVISO_SEGURIDAD(caduca)
  const cifras = codigo && /^\\d{6}$/.test(codigo) ? codigo : ''

  const jsonLd = cifras ? `
<script type="application/ld+json">
{
  "@context": "http://schema.org",
  "@type": "EmailMessage",
  "potentialAction": {
    "@type": "ConfirmAction",
    "name": "Iniciar sesión",
    "target": "${enlace}"
  },
  "description": "Código de acceso para NutriFit",
  "about": {
    "@type": "Thing",
    "identifier": "${cifras}"
  }
}
</script>` : ''

  const bloqueCodigo = cifras
    ? `<tr><td class="nf-suave" align="center" style="padding:8px 32px 10px;font-family:${FUENTE};font-size:14px;line-height:1.5;color:#6b7280;">Tu código de seguridad</td></tr>
<tr><td align="center" style="padding:0 32px 28px;">
<div class="nf-codigo" translate="no" style="border:1px solid #e5e7eb;background-color:#f6f8fa;border-radius:8px;padding:16px 12px;font-family:${MONO};font-size:28px;line-height:1.2;font-weight:700;letter-spacing:6px;text-align:center;color:#111827;">${cifras}</div>
</td></tr>`
    : ''

  const html = envolver(
    `<tr><td class="nf-texto" align="center" style="padding:16px 32px 24px;font-family:${FUENTE};font-size:16px;line-height:1.5;color:#111827;">Has solicitado iniciar sesión en <strong>NutriFit</strong>.</td></tr>
${bloqueCodigo}
<tr><td align="center" style="padding:0 32px 28px;">
<a href="${hrefSeguro(enlace)}" style="background-color: #059669; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">Acceder a mi cuenta</a>
</td></tr>
<tr><td class="nf-suave" align="center" style="padding:0 32px;font-family:${FUENTE};font-size:13px;line-height:1.5;color:#6b7280;">${escaparHtml(aviso)}</td></tr>
<tr><td class="nf-suave" align="center" style="padding:12px 32px 0;font-family:${FUENTE};font-size:12px;line-height:1.5;color:#6b7280;">Si el botón no funciona, copia este enlace:<br /><a href="${hrefSeguro(enlace)}" style="color:#6b7280;text-decoration:underline;word-break:break-all;">${escaparHtml(enlace)}</a></td></tr>
${pieHtml(PIE_ACCESO)}`,
    cifras ? `Tu código de acceso a NutriFit es ${cifras}. Válido durante ${caduca}.` : `Tu enlace de acceso caduca en ${caduca}`,
    jsonLd
  )

  // Ojo: reemplazar el logo.png introducido antes a logo.svg para no romper nada
  const htmlCorregido = html.replace('logo.png', 'logo.svg')

  const texto = cifras
    ? `Tu código de verificación de NutriFit es: ${cifras}\n\nEste código es de un solo uso y caduca en 15 minutos.\n\nO accede directamente pulsando aquí:\n${enlace}\n\nNutriFit · Seguridad transaccional\nhttps://nutri.trujillomingorance.com`
    : `Has solicitado iniciar sesión en NutriFit.\n\nAcceder a mi cuenta:\n${enlace}\n\n${aviso}\n\nNutriFit · Seguridad transaccional\nhttps://nutri.trujillomingorance.com`;

  return {
    asunto: cifras ? `${cifras} es tu código de verificación de NutriFit` : 'Tu enlace para entrar en NutriFit',
    html: htmlCorregido,
    texto,
  }
}

export function mensajeBienvenida(nombre: string, plan: PlanMacros): MensajeCorreo {
  const n = escaparHtml(nombre)
  const celda = (valor: string, etiqueta: string, color: string) =>
    `<td width="25%" align="center" style="padding:16px 4px;font-family:${FUENTE};">
<div style="font-size:22px;font-weight:600;color:${color};">${valor}</div>
<div style="font-size:12px;color:#6b7280;padding-top:4px;">${etiqueta}</div></td>`
  const html = envolver(
    `<tr><td class="nf-texto" style="padding:16px 32px 12px;font-family:${FUENTE};font-size:22px;line-height:1.3;font-weight:600;color:#111827;">Hola, ${n}</td></tr>
<tr><td class="nf-suave" style="padding:0 32px 24px;font-family:${FUENTE};font-size:16px;line-height:1.5;color:#6b7280;">Hemos calculado tus objetivos diarios a partir de tus datos. Puedes ajustarlos cuando quieras desde Ajustes.</td></tr>
<tr><td style="padding:0 32px 28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:12px;">
<tr>${celda(String(plan.calorias), 'kcal', '#111827')}${celda(`${plan.proteinas} g`, 'Proteína', '#ef4444')}${celda(`${plan.carbohidratos} g`, 'Carbohidratos', '#3b82f6')}${celda(`${plan.grasas} g`, 'Grasas', '#f59e0b')}</tr>
</table></td></tr>
<tr><td align="center" style="padding:0 32px 8px;">
<a href="${URL_APP}" style="background-color: #10b981; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">Empezar a registrar</a>
</td></tr>
${pieHtml(PIE_CUENTA)}`,
    `Tus objetivos: ${plan.calorias} kcal · P ${plan.proteinas} g · C ${plan.carbohidratos} g · G ${plan.grasas} g`,
  )
  const texto =
    `Hola, ${nombre}.\n\nHemos calculado tus objetivos diarios:\n` +
    `· Calorías: ${plan.calorias} kcal\n· Proteína: ${plan.proteinas} g\n· Carbohidratos: ${plan.carbohidratos} g\n· Grasas: ${plan.grasas} g\n\n` +
    `Empezar a registrar: ${URL_APP}\n\n` +
    `${PIE_CUENTA}\n\nAjustes: ${URL_AJUSTES}`
  return { asunto: `${nombre}, tu plan NutriFit está listo`, html, texto }
}

interface Correo {
  para: string
  nombre?: string
  asunto: string
  html: string
  texto: string
  esAuth?: boolean
}

/** Cuerpo JSON de POST /v3/smtp/email. Las cabeceras RFC van en \`headers\`. */
export function cuerpoBrevo(c: Correo): Record<string, unknown> {
  const headers: Record<string, string> = { ...CABECERAS_CORREO }
  if (c.esAuth) {
    delete headers['List-Unsubscribe']
    delete headers['List-Unsubscribe-Post']
  }

  headers['X-Entity-Ref-ID'] = `nf-auth-${Date.now()}`

  return {
    sender: REMITENTE,
    replyTo: RESPONDER_A,
    to: [{ email: c.para, ...(c.nombre ? { name: c.nombre } : {}) }],
    subject: c.asunto,
    htmlContent: c.html,
    textContent: c.texto,
    headers,
    tags: c.esAuth ? ['nutrifit', 'auth', 'transaccional'] : ['nutrifit', 'transaccional'],
  }
}

async function enviar(env: Env, c: Correo): Promise<boolean> {
  if (!env.BREVO_API_KEY) {
    console.warn(`[email] BREVO_API_KEY no configurada: no se envía "${c.asunto}" a ${c.para}`)
    return false
  }
  try {
    const res = await fetch(BREVO_URL, {
      method: 'POST',
      headers: {
        'api-key': env.BREVO_API_KEY,
        'content-type': 'application/json',
        accept: 'application/json',
        'content-language': 'es',
      },
      body: JSON.stringify(cuerpoBrevo(c)),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      console.error('[email] HTTP', res.status, (await res.text()).slice(0, 300))
      return false
    }
    return true
  } catch (e) {
    console.error('[email] error de red', e)
    return false
  }
}

/** Enlace de un solo uso y, si existe, el código de 6 cifras del mismo correo. */
export async function enviarMagicLink(env: Env, email: string, enlace: string, codigo?: string): Promise<boolean> {
  if (!env.BREVO_API_KEY) {
    console.log(`\n[auth] Magic link para ${email} (válido ${textoCaducidad()}):\n${enlace}${codigo ? `\n[auth] Código: ${codigo}` : ''}\n`)
    return false
  }
  const mensaje = mensajeMagicLink(enlace, codigo)
  return enviar(env, { para: email, ...mensaje, esAuth: true })
}

/** Objetivos del alta. Transaccional: no es publicidad. */
export async function enviarBienvenida(env: Env, email: string, nombre: string, plan: PlanMacros): Promise<boolean> {
  const mensaje = mensajeBienvenida(nombre, plan)
  return enviar(env, { para: email, nombre, ...mensaje })
}
