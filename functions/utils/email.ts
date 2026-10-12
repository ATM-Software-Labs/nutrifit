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
  `NutriFit · Desarrollado en Barcelona, España.\n` +
  `Correo transaccional de seguridad solicitado por el usuario. Sin publicidad ni cookies comerciales.\n\n` +
  DERECHOS

const PIE_CUENTA =
  `NutriFit · Desarrollado en Barcelona, España.\n` +
  `Este es un correo transaccional sobre la configuración de tu cuenta. ${FRASE_NO_COMERCIAL}\n\n` +
  DERECHOS

function pieHtml(texto: string): string {
  const html = escaparHtml(texto)
    .replaceAll(URL_PRIVACIDAD, `<a href="${URL_PRIVACIDAD}" style="color:#6b7280;text-decoration:underline;">${URL_PRIVACIDAD}</a>`)
    .replaceAll(RESPONDER_A.email, `<a href="mailto:${RESPONDER_A.email}" style="color:#6b7280;text-decoration:underline;">${RESPONDER_A.email}</a>`)
    .replaceAll('\n\n', '<br /><br />')
    .replaceAll('\n', '<br />')
  return `<!-- Widgets tecnologicos -->
<tr><td align="center" style="padding:24px 24px 0;">
  <!--[if mso]><table role="presentation" width="432" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:12px;background-color:#f9fafb;">
    <tr>
      <td width="25%" align="center" style="padding:10px 4px;border-right:1px solid #e5e7eb;font-family:${FUENTE};">
        <div style="font-size:12px;font-weight:700;color:#2563eb;">✨ Gemini AI</div>
        <div style="font-size:10px;color:#6b7280;margin-top:2px;">Visión Flash</div>
      </td>
      <td width="25%" align="center" style="padding:10px 4px;border-right:1px solid #e5e7eb;font-family:${FUENTE};">
        <div style="font-size:12px;font-weight:700;color:#0284c7;">🛡️ Entra / Copilot</div>
        <div style="font-size:10px;color:#6b7280;margin-top:2px;">SSO Universal</div>
      </td>
      <td width="25%" align="center" style="padding:10px 4px;border-right:1px solid #e5e7eb;font-family:${FUENTE};">
        <div style="font-size:12px;font-weight:700;color:#ea580c;">⚡ Cloudflare</div>
        <div style="font-size:10px;color:#6b7280;margin-top:2px;">Borde Anycast D1</div>
      </td>
      <td width="25%" align="center" style="padding:10px 4px;font-family:${FUENTE};">
        <div style="font-size:12px;font-weight:700;color:#059669;">🥗 Food Facts</div>
        <div style="font-size:10px;color:#6b7280;margin-top:2px;">Open Database</div>
      </td>
    </tr>
  </table>
  <!--[if mso]></td></tr></table><![endif]-->
</td></tr>
<tr><td align="center" style="padding:18px 32px 4px;">
  <!-- Boton directo de baja / unsubscribe -->
  <a href="${URL_AJUSTES}#notificaciones" style="display:inline-block;padding:9px 20px;background-color:#f3f4f6;border:1px solid #d1d5db;border-radius:8px;font-family:${FUENTE};font-size:12px;font-weight:600;color:#374151;text-decoration:none;">
    Darse de baja / Unsubscribe
  </a>
</td></tr>
<tr><td style="padding:24px 32px 0;"><hr style="border:none;border-top:1px solid #e5e7eb;margin:0;" /></td></tr>
<tr><td class="nf-suave" align="center" style="padding:20px 32px 10px;font-size:11px;line-height:1.5;color:#6b7280;text-align:center;">${html}</td></tr>
<tr><td class="nf-suave" align="center" style="padding:0 32px 24px;font-size:12px;line-height:1.5;color:#9ca3af;text-align:center;"><a href="${URL_AJUSTES}#notificaciones" style="color:#9ca3af;text-decoration:underline;">Gestionar notificaciones</a> · <a href="${URL_AJUSTES}#notificaciones" style="color:#9ca3af;text-decoration:underline;">Darme de baja</a></td></tr>`
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
    .nf-codigo { background-color: #27272a !important; color: #10b981 !important; border-color: #3f3f46 !important; }
  }
</style>
${jsonLd || ''}
</head>
<body class="nf-body" style="margin:0;padding:0;background-color:#f6f8fa;font-family:${FUENTE};color:#111827;">
<span style="display:none;font-size:1px;color:#f6f8fa;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${escaparHtml(preheader)}</span>
<table role="presentation" class="nf-fondo" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f6f8fa" style="background-color:#f6f8fa;">
<tr><td align="center" style="padding:48px 16px;">
<!--[if mso]>
<table role="presentation" width="480" align="center" cellpadding="0" cellspacing="0" border="0">
<tr><td>
<![endif]-->
<table role="presentation" class="nf-tarjeta" width="480" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="width:100%;max-width:480px;background-color:#ffffff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.04);">
<tr><td align="center" style="padding:40px 32px 16px;font-family:${FUENTE};">
<img src="${URL_APP}/logo.png" alt="NutriFit" width="64" height="64" style="display:inline-block;width:64px;height:auto;vertical-align:middle;border:0;outline:none;text-decoration:none;" />
<div style="margin-top:16px;font-size:24px;font-weight:700;letter-spacing:-0.3px;color:${MINT};">NutriFit</div>
<div style="margin-top:8px;font-size:12px;line-height:1.5;color:#9ca3af;font-family:${FUENTE};text-align:center;">
  <span>NutriFit &lt;<a href="mailto:${REMITENTE.email}" style="color:#9ca3af;text-decoration:none;">${REMITENTE.email}</a>&gt;</span>
  <span style="margin:0 6px;color:#d1d5db;">·</span>
  <a href="${URL_AJUSTES}#notificaciones" style="color:#059669;text-decoration:underline;font-weight:600;">Darse de baja / Unsubscribe</a>
</div>
</td></tr>
${cuerpo}
</table>
<!--[if mso]>
</td></tr>
</table>
<![endif]-->
</td></tr></table>
</body>
</html>`
}

export interface MensajeCorreo {
  asunto: string
  html: string
  texto: string
}

export function mensajeMagicLink(enlace: string, codigo?: string, emailDestino?: string): MensajeCorreo {
  const caduca = textoCaducidad()
  const aviso = AVISO_SEGURIDAD(caduca)
  const cifras = codigo && /^\d{6}$/.test(codigo) ? codigo : ''

  const schemaScripts = cifras ? `
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "EmailMessage",
  "potentialAction": {
    "@type": "ConfirmAction",
    "name": "Acceder a NutriFit",
    "target": "${enlace}"
  },
  "description": "Iniciar sesión en NutriFit",
  "about": {
    "@type": "Thing",
    "name": "OneTimeCode",
    "identifier": "${cifras}"
  }
}
</script>
<script type="application/adaptivecard+json">
{
  "type": "AdaptiveCard",
  "version": "1.0",
  "body": [
    {
      "type": "TextBlock",
      "text": "Código de verificación de NutriFit",
      "weight": "Bolder",
      "size": "Medium"
    },
    {
      "type": "TextBlock",
      "text": "Tu código de acceso es **${cifras}**. Válido durante 15 minutos.",
      "wrap": true
    }
  ],
  "actions": [
    {
      "type": "Action.OpenUrl",
      "title": "Acceder a mi cuenta",
      "url": "${enlace}"
    }
  ]
}
</script>` : ''

  const cuentaTxt = emailDestino ? ` (<strong>${escaparHtml(emailDestino)}</strong>)` : ''
  const cuentaPlano = emailDestino ? ` (${emailDestino})` : ''

  const bloqueCodigo = cifras
    ? `<tr><td class="nf-suave" align="center" style="padding:4px 32px 12px;font-family:${FUENTE};font-size:14px;line-height:1.5;color:#6b7280;text-align:center;">Tu código de verificación de NutriFit es:</td></tr>
<tr><td align="center" style="padding:0 32px 24px;">
<div class="nf-codigo" translate="no" style="display:inline-block;border:1px solid #e5e7eb;background-color:#f6f8fa;border-radius:12px;padding:16px 32px;font-family:${MONO};font-size:28px;line-height:1.2;font-weight:700;letter-spacing:6px;text-align:center;color:#059669;">${cifras}</div>
</td></tr>`
    : ''

  const html = envolver(
    `<tr><td class="nf-texto" align="center" style="padding:8px 32px 10px;font-family:${FUENTE};font-size:22px;line-height:1.3;font-weight:700;color:#111827;text-align:center;">Código de verificación de NutriFit</td></tr>
<tr><td class="nf-suave" align="center" style="padding:0 32px 20px;font-family:${FUENTE};font-size:15px;line-height:1.6;color:#4b5563;text-align:center;">Hemos recibido una solicitud para acceder a tu cuenta${cuentaTxt} a través de tu dirección de correo electrónico. Has solicitado iniciar sesión en <strong>NutriFit</strong>.</td></tr>
${bloqueCodigo}
<tr><td align="center" style="padding:0 32px 24px;">
<a href="${hrefSeguro(enlace)}" style="background-color: #059669; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">Acceder a mi cuenta</a>
</td></tr>
<tr><td class="nf-suave" align="center" style="padding:0 32px 14px;font-family:${FUENTE};font-size:13px;line-height:1.6;color:#6b7280;text-align:center;">Si no has solicitado este código, es posible que otra persona esté intentando acceder a la cuenta de NutriFit${cuentaTxt}. No reenvíes ni des este código a nadie.</td></tr>
<tr><td class="nf-suave" align="center" style="padding:0 32px 20px;font-family:${FUENTE};font-size:12px;line-height:1.5;color:#9ca3af;text-align:center;">${escaparHtml(aviso)}</td></tr>
<tr><td class="nf-texto" align="center" style="padding:0 32px 2px;font-family:${FUENTE};font-size:14px;font-weight:600;color:#374151;text-align:center;">Atentamente,</td></tr>
<tr><td class="nf-suave" align="center" style="padding:0 32px 20px;font-family:${FUENTE};font-size:13px;color:#6b7280;text-align:center;">El equipo de NutriFit</td></tr>
<tr><td class="nf-suave" align="center" style="padding:10px 32px 0;font-family:${FUENTE};font-size:11px;line-height:1.5;color:#9ca3af;text-align:center;">Si el botón no funciona, copia este enlace en tu navegador:<br /><a href="${hrefSeguro(enlace)}" style="color:#6b7280;text-decoration:underline;word-break:break-all;">${escaparHtml(enlace)}</a></td></tr>
${pieHtml(PIE_ACCESO)}`,
    cifras ? `Tu código de verificación de NutriFit es ${cifras}. Válido durante 15 minutos.` : `Tu enlace de acceso caduca en ${caduca}`,
    schemaScripts
  )

  const texto = cifras
    ? `Código de verificación de NutriFit\n\n` +
      `Estimado usuario de NutriFit,\n\n` +
      `Hemos recibido una solicitud para acceder a tu cuenta de NutriFit${cuentaPlano} a través de tu dirección de correo electrónico.\n\n` +
      `Tu código de NutriFit es: ${cifras}\n\n` +
      `O pulsa este enlace para acceder directamente a tu cuenta:\n${enlace}\n\n` +
      `Si no has solicitado este código, es posible que otra persona esté intentando acceder a la cuenta de NutriFit${cuentaPlano}. No reenvíes ni des este código a nadie.\n\n` +
      `${aviso}\n\n` +
      `Atentamente,\nEl equipo de NutriFit\n\n` +
      `Este correo no admite respuestas directas. Para soporte: ${RESPONDER_A.email}\n` +
      `NutriFit · Seguridad transaccional\n${URL_APP}\n\n` +
      `Para gestionar tus notificaciones o darte de baja: ${URL_AJUSTES}`
    : `Código de acceso a NutriFit\n\n` +
      `Hemos recibido una solicitud para acceder a tu cuenta de NutriFit${cuentaPlano}.\n\n` +
      `Acceder a mi cuenta:\n${enlace}\n\n` +
      `${aviso}\n\n` +
      `Atentamente,\nEl equipo de NutriFit\n\n` +
      `NutriFit · Seguridad transaccional\n${URL_APP}\n\n` +
      `Para gestionar tus notificaciones: ${URL_AJUSTES}`;

  return {
    asunto: cifras ? `${cifras} es tu código de verificación de NutriFit` : 'Tu enlace para entrar en NutriFit',
    html,
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
    `${PIE_CUENTA}\n\nPara gestionar tus notificaciones o darte de baja: ${URL_AJUSTES}`
  return { asunto: `${nombre}, tu plan NutriFit está listo`, html, texto }
}

interface Correo {
  /** URL HTTPS de baja en un clic (RFC 8058) para recordatorios y resúmenes. */
  bajaUrl?: string
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

  headers['X-Entity-Ref-ID'] = `nf-${c.esAuth ? 'auth' : 'aviso'}-${Date.now()}`
  if (c.bajaUrl) headers['List-Unsubscribe'] = `<${c.bajaUrl}>, <mailto:${RESPONDER_A.email}?subject=baja%20recordatorios>`

  return {
    sender: REMITENTE,
    replyTo: RESPONDER_A,
    to: [{ email: c.para, ...(c.nombre ? { name: c.nombre } : {}) }],
    subject: c.asunto,
    htmlContent: c.html,
    textContent: c.texto,
    headers,
    tags: c.esAuth ? ['nutrifit', 'auth', 'transaccional'] : c.bajaUrl ? ['nutrifit', 'recordatorio'] : ['nutrifit', 'transaccional'],
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
  const mensaje = mensajeMagicLink(enlace, codigo, email)
  return enviar(env, { para: email, ...mensaje, esAuth: true })
}

/** Objetivos del alta. Transaccional: no es publicidad. */
export async function enviarBienvenida(env: Env, email: string, nombre: string, plan: PlanMacros): Promise<boolean> {
  const mensaje = mensajeBienvenida(nombre, plan)
  return enviar(env, { para: email, nombre, ...mensaje })
}

const PIE_AVISOS =
  `NutriFit · Recibes este correo porque activaste los recordatorios por email en Ajustes.\n` +
  `Puedes desactivarlos en un clic con el enlace de baja o desde Ajustes → Recordatorios.\n\n` +
  DERECHOS

function botonHtml(href: string, texto: string): string {
  return `<tr><td align="center" style="padding:0 32px 8px;"><a href="${hrefSeguro(href)}" style="background-color:#047857;color:#ffffff;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:600;display:inline-block;font-family:${FUENTE};">${escaparHtml(texto)}</a></td></tr>`
}

function jsonLdVer(url: string, nombre: string, descripcion: string): string {
  const d = { '@context': 'https://schema.org', '@type': 'EmailMessage', description: descripcion, publisher: { '@type': 'Organization', name: 'NutriFit', url: URL_APP }, potentialAction: { '@type': 'ViewAction', url, name: nombre } }
  return `<script type="application/ld+json">${JSON.stringify(d).replace(/</g, '\\u003c')}</script>`
}

/** Recordatorio puntual (comida sin registrar, cierre del día…). Resumen arriba para asistentes de IA. */
export function mensajeRecordatorio(titulo: string, cuerpo: string, url: string, bajaUrl: string): MensajeCorreo {
  const enlace = url.startsWith('http') ? url : `${URL_APP}${url}`
  const html = envolver(
    `<tr><td class="nf-texto" style="padding:16px 32px 8px;font-family:${FUENTE};font-size:22px;line-height:1.3;font-weight:600;color:#111827;">${escaparHtml(titulo)}</td></tr>
<tr><td class="nf-suave" style="padding:0 32px 24px;font-family:${FUENTE};font-size:16px;line-height:1.5;color:#4b5563;">${escaparHtml(cuerpo)}</td></tr>
${botonHtml(enlace, 'Registrar ahora')}
<tr><td class="nf-suave" align="center" style="padding:16px 32px 0;font-family:${FUENTE};font-size:12px;color:#6b7280;"><a href="${hrefSeguro(bajaUrl)}" style="color:#6b7280;text-decoration:underline;">Desactivar recordatorios por email</a></td></tr>
${pieHtml(PIE_AVISOS)}`,
    `${titulo}: ${cuerpo}`,
    jsonLdVer(enlace, 'Registrar ahora', `${titulo}. ${cuerpo}`),
  )
  const texto = `${titulo}\n\n${cuerpo}\n\nRegistrar ahora: ${enlace}\n\nDesactivar estos recordatorios: ${bajaUrl}\n\n${PIE_AVISOS}`
  return { asunto: `${titulo} · NutriFit`, html, texto }
}

export interface DatosResumen { diasRegistrados: number; adherenciaPct: number; diasEnObjetivo: number; mediaCalorias: number; racha: number; logros: string[]; desde: string; hasta: string }

export function mensajeResumenSemanal(nombre: string | null, r: DatosResumen, bajaUrl: string): MensajeCorreo {
  const saludo = nombre ? `Hola, ${nombre}` : 'Hola'
  const resumen = `${r.diasRegistrados} de 7 días registrados (${r.adherenciaPct} %), ${r.diasEnObjetivo} en tu objetivo de calorías y racha de ${r.racha} días.`
  const celda = (v: string, e: string) => `<td width="25%" align="center" style="padding:14px 4px;font-family:${FUENTE};"><div class="nf-texto" style="font-size:22px;font-weight:600;color:#111827;">${escaparHtml(v)}</div><div style="font-size:12px;color:#6b7280;padding-top:4px;">${escaparHtml(e)}</div></td>`
  const logros = r.logros.length ? `<tr><td class="nf-suave" style="padding:0 32px 20px;font-family:${FUENTE};font-size:14px;line-height:1.6;color:#4b5563;"><strong>Logros de la semana:</strong> ${r.logros.map(escaparHtml).join(' · ')}</td></tr>` : ''
  const html = envolver(
    `<tr><td class="nf-texto" style="padding:16px 32px 8px;font-family:${FUENTE};font-size:22px;font-weight:600;color:#111827;">${escaparHtml(saludo)}, tu semana en NutriFit</td></tr>
<tr><td class="nf-suave" style="padding:0 32px 20px;font-family:${FUENTE};font-size:16px;line-height:1.5;color:#4b5563;">${escaparHtml(resumen)}</td></tr>
<tr><td style="padding:0 32px 20px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:12px;"><tr>${celda(`${r.adherenciaPct} %`, 'Constancia')}${celda(String(r.racha), 'Racha')}${celda(String(r.diasEnObjetivo), 'En objetivo')}${celda(r.mediaCalorias ? String(r.mediaCalorias) : '—', 'kcal/día')}</tr></table></td></tr>
${logros}${botonHtml(`${URL_APP}/logros`, 'Ver mis logros')}
<tr><td class="nf-suave" align="center" style="padding:16px 32px 0;font-family:${FUENTE};font-size:12px;color:#6b7280;"><a href="${hrefSeguro(bajaUrl)}" style="color:#6b7280;text-decoration:underline;">No recibir más resúmenes</a></td></tr>
${pieHtml(PIE_AVISOS)}`,
    resumen,
    jsonLdVer(`${URL_APP}/logros`, 'Ver mis logros', `Resumen semanal NutriFit: ${resumen}`),
  )
  const texto = `${saludo}, tu semana en NutriFit (${r.desde} a ${r.hasta})\n\n${resumen}\n` +
    `· Constancia: ${r.adherenciaPct} %\n· Racha: ${r.racha} días\n· Días en objetivo: ${r.diasEnObjetivo}\n· Media: ${r.mediaCalorias || '—'} kcal/día\n` +
    (r.logros.length ? `· Logros: ${r.logros.join(', ')}\n` : '') +
    `\nVer mis logros: ${URL_APP}/logros\n\nNo recibir más resúmenes: ${bajaUrl}\n\n${PIE_AVISOS}`
  return { asunto: `Tu semana: ${r.adherenciaPct} % de constancia y racha de ${r.racha} días`, html, texto }
}

/** Envío de recordatorio/resumen con List-Unsubscribe de un clic. */
export async function enviarAviso(env: Env, para: string, m: MensajeCorreo, bajaUrl: string): Promise<boolean> {
  return enviar(env, { para, ...m, bajaUrl })
}
