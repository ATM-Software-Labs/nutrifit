/**
 * Emails transaccionales vía Brevo (REST v3). Todos los envíos son NO
 * bloqueantes: ante cualquier fallo se registra en consola y se devuelve false,
 * nunca se lanza una excepción hacia el handler.
 */
import type { Env } from './env.ts'
import type { PlanMacros } from '../../src/lib/macros.ts'

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email'
// Los emails salen del dominio raíz (autenticado en Brevo): en nutri.* hay un
// CNAME a Pages, que no puede convivir con registros MX/TXT.
const REMITENTE = { name: 'NutriFit', email: 'nutrifit@trujillomingorance.com' }
const RESPONDER_A = { name: 'Soporte NutriFit', email: 'soporte@trujillomingorance.com' }
const URL_APP = 'https://nutri.trujillomingorance.com'

const MINT = '#10B981'
const GRAFITO = '#111827'
const GRIS = '#6B7280'
const BORDE = '#E5E7EB'
const FUENTE = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif"

/** Escapa texto para interpolarlo en HTML. */
export function escaparHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

interface Correo {
  para: string
  nombre?: string
  asunto: string
  html: string
  texto: string
}

async function enviar(env: Env, c: Correo): Promise<boolean> {
  if (!env.BREVO_API_KEY) {
    console.warn(`[brevo] BREVO_API_KEY no configurada: no se envía "${c.asunto}" a ${c.para}`)
    return false
  }
  try {
    const res = await fetch(BREVO_URL, {
      method: 'POST',
      headers: { 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: REMITENTE,
        replyTo: RESPONDER_A,
        to: [{ email: c.para, ...(c.nombre ? { name: c.nombre } : {}) }],
        subject: c.asunto,
        htmlContent: c.html,
        textContent: c.texto,
        tags: ['nutrifit'],
      }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      console.error('[brevo] HTTP', res.status, (await res.text()).slice(0, 300))
      return false
    }
    return true
  } catch (e) {
    console.error('[brevo] error de red', e)
    return false
  }
}

// ------------------------------------------------------------------ plantillas
function plantilla(contenido: string, preheader: string): string {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><title>NutriFit</title></head>
<body style="margin:0;padding:0;background:#FFFFFF;font-family:${FUENTE};color:${GRAFITO};">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escaparHtml(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
<tr><td style="padding-bottom:32px;font-size:20px;font-weight:600;letter-spacing:-0.3px;color:${GRAFITO};">
Nutri<span style="color:${MINT};">Fit</span></td></tr>
${contenido}
<tr><td style="padding-top:40px;font-size:12px;line-height:18px;color:${GRIS};">
NutriFit · Barcelona · <a href="${URL_APP}" style="color:${GRIS};">nutri.trujillomingorance.com</a><br>
¿Dudas? Escríbenos a <a href="mailto:${RESPONDER_A.email}" style="color:${GRIS};">${RESPONDER_A.email}</a></td></tr>
</table></td></tr></table></body></html>`
}

function boton(href: string, texto: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="border-radius:12px;background:${MINT};">
<a href="${escaparHtml(href)}" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:12px;">${escaparHtml(texto)}</a>
</td></tr></table>`
}

// ------------------------------------------------------------------ magic link
/** «123456» → «123 456» (más fácil de leer y copiar). */
const agrupar = (c: string) => `${c.slice(0, 3)} ${c.slice(3)}`

export async function enviarMagicLink(env: Env, email: string, enlace: string, codigo?: string): Promise<boolean> {
  if (!env.BREVO_API_KEY) {
    // Desarrollo: imprimir el enlace (y el código) en consola en vez de enviarlo.
    console.log(`\n[auth] 🔗 Magic link para ${email} (válido 15 min):\n${enlace}${codigo ? `\n[auth] 🔢 Código: ${codigo}` : ''}\n`)
    return false
  }
  const bloqueCodigo = codigo
    ? `<tr><td style="font-size:14px;line-height:22px;color:${GRIS};padding-bottom:10px;">
¿Estás en otro dispositivo? Escribe este código en la pantalla de acceso:</td></tr>
<tr><td style="padding-bottom:28px;">
<div style="display:inline-block;padding:14px 22px;border:1px solid ${BORDE};border-radius:14px;font-size:30px;line-height:36px;font-weight:600;letter-spacing:6px;color:${GRAFITO};font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;">${escaparHtml(agrupar(codigo))}</div>
</td></tr>`
    : ''
  const html = plantilla(
    `<tr><td style="font-size:24px;line-height:32px;font-weight:600;padding-bottom:12px;">Tu acceso a NutriFit</td></tr>
<tr><td style="font-size:16px;line-height:24px;color:${GRIS};padding-bottom:28px;">
Pulsa el botón para iniciar sesión. El enlace${codigo ? ' y el código caducan' : ' caduca'} en 15 minutos y solo ${codigo ? 'funcionan' : 'funciona'} una vez.</td></tr>
<tr><td style="padding-bottom:28px;">${boton(enlace, 'Entrar en NutriFit')}</td></tr>
${bloqueCodigo}
<tr><td style="font-size:13px;line-height:20px;color:${GRIS};">
Si no has pedido este acceso, ignora este correo: nadie podrá entrar sin él. Nunca compartas el código.</td></tr>`,
    codigo ? `Tu código: ${agrupar(codigo)} · o entra con el enlace (caduca en 15 minutos)` : 'Tu enlace para entrar en NutriFit (caduca en 15 minutos)',
  )
  const texto =
    `Entra en NutriFit con este enlace (caduca en 15 minutos, un solo uso):\n${enlace}\n\n` +
    (codigo ? `O escribe este código en la pantalla de acceso: ${agrupar(codigo)}\n\n` : '') +
    'Si no lo has pedido, ignora este correo. Nunca compartas el código.'
  return enviar(env, { para: email, asunto: codigo ? `${agrupar(codigo)} es tu código de NutriFit` : 'Tu enlace para entrar en NutriFit', html, texto })
}

// ------------------------------------------------------------------ bienvenida
export async function enviarBienvenida(env: Env, email: string, nombre: string, plan: PlanMacros): Promise<boolean> {
  const n = escaparHtml(nombre)
  const celda = (valor: string, etiqueta: string, color: string) =>
    `<td width="25%" align="center" style="padding:16px 4px;">
<div style="font-size:22px;font-weight:600;color:${color};">${valor}</div>
<div style="font-size:12px;color:${GRIS};padding-top:4px;">${etiqueta}</div></td>`
  const html = plantilla(
    `<tr><td style="font-size:24px;line-height:32px;font-weight:600;padding-bottom:12px;">¡Bienvenido/a, ${n}!</td></tr>
<tr><td style="font-size:16px;line-height:24px;color:${GRIS};padding-bottom:24px;">
Hemos calculado tus objetivos diarios a partir de tus datos. Puedes ajustarlos cuando quieras.</td></tr>
<tr><td style="padding-bottom:28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BORDE};border-radius:16px;">
<tr>${celda(String(plan.calorias), 'kcal', GRAFITO)}${celda(`${plan.proteinas} g`, 'Proteína', '#EF4444')}${celda(
      `${plan.carbohidratos} g`,
      'Carbohidratos',
      '#3B82F6',
    )}${celda(`${plan.grasas} g`, 'Grasas', '#F59E0B')}</tr>
</table></td></tr>
<tr><td style="padding-bottom:8px;">${boton(URL_APP, 'Empezar a registrar')}</td></tr>`,
    `Tus objetivos: ${plan.calorias} kcal · P ${plan.proteinas} g · C ${plan.carbohidratos} g · G ${plan.grasas} g`,
  )
  const texto =
    `¡Bienvenido/a a NutriFit, ${nombre}!\n\nTus objetivos diarios:\n` +
    `· Calorías: ${plan.calorias} kcal\n· Proteína: ${plan.proteinas} g\n· Carbohidratos: ${plan.carbohidratos} g\n· Grasas: ${plan.grasas} g\n\n` +
    `Empieza aquí: ${URL_APP}`
  return enviar(env, { para: email, nombre, asunto: `${nombre}, tu plan NutriFit está listo`, html, texto })
}
