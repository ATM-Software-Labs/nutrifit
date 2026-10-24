/**
 * «Compartir mi día»: instantánea del día (solo lo que sale en la tarjeta), filtros de
 * privacidad, texto para chats, página pública /d/<token> con Open Graph y validación
 * del PNG de la vista previa. Funciones puras: las usan las Functions, el cliente y los tests.
 * Nunca hay fotos: cada comida es un emoji + su nombre.
 */
import { emojiDe } from '../../src/lib/miniaturaComida.ts'

export type TipoComidaDia = 'desayuno' | 'comida' | 'cena' | 'snack'
export const ORDEN_TIPOS: TipoComidaDia[] = ['desayuno', 'comida', 'cena', 'snack']
export const NOMBRES_TIPO: Record<TipoComidaDia, string> = { desayuno: 'Desayuno', comida: 'Comida', cena: 'Cena', snack: 'Snacks' }
export const EMOJI_TIPO: Record<TipoComidaDia, string> = { desayuno: '☕', comida: '🍽️', cena: '🌙', snack: '🍎' }

export interface ItemDia { emoji: string; nombre?: string; kcal?: number }
export interface GrupoDia { tipo: TipoComidaDia; nombre: string; items: ItemDia[]; kcal?: number }
export interface Macros { proteinas: number; carbohidratos: number; grasas: number }
export interface DiaCompartido {
  fecha: string
  nombre?: string
  grupos: GrupoDia[]
  kcal?: number
  metaKcal?: number
  macros: Macros
  metaMacros?: Macros
  aguaMl: number
  metaAguaMl: number
  pesoKg?: number
  racha?: number
  logros: { titulo: string; emoji: string }[]
}

export interface OpcionesPrivacidad {
  ocultarKcal: boolean
  ocultarPesoRacha: boolean
  soloEmojis: boolean
  mostrarNombre: boolean
}
export const PRIVACIDAD_POR_DEFECTO: OpcionesPrivacidad = { ocultarKcal: false, ocultarPesoRacha: false, soloEmojis: false, mostrarNombre: false }

export const EMOJI_LOGRO: Record<string, string> = {
  utensils: '🍴', camera: '📸', flame: '🔥', beef: '🥩', droplet: '💧', scale: '⚖️', barcode: '🏷️', target: '🎯', sunrise: '🌅', calendar: '📅', star: '⭐',
}

const r0 = (n: number) => Math.round(n)
const r1 = (n: number) => Math.round(n * 10) / 10

export interface FilaDia { tipo_comida: string; descripcion: string; calorias: number; proteinas: number; carbohidratos: number; grasas: number; emoji: string | null }

/** Primer nombre, sin apellidos ni emails (máx. 24 caracteres). */
export function primerNombre(n: string | null | undefined): string | undefined {
  const p = (n ?? '').trim().split(/\s+/)[0] ?? ''
  if (!p || p.includes('@')) return undefined
  return p.slice(0, 24)
}

/** Instantánea completa (sin filtros) a partir de las filas del día. */
export function construirDia(a: {
  fecha: string
  filas: FilaDia[]
  nombre?: string | null
  nombresTipo?: Partial<Record<TipoComidaDia, string>>
  metaKcal?: number | null
  metaMacros?: Macros | null
  aguaMl?: number | null
  metaAguaMl?: number | null
  pesoKg?: number | null
  racha?: number | null
  logros?: { titulo: string; icono: string }[]
}): DiaCompartido {
  const grupos: GrupoDia[] = []
  const tot = { kcal: 0, proteinas: 0, carbohidratos: 0, grasas: 0 }
  for (const tipo of ORDEN_TIPOS) {
    const filas = a.filas.filter((f) => f.tipo_comida === tipo)
    if (!filas.length) continue
    let kcal = 0
    const items = filas.slice(0, 20).map((f) => {
      kcal += f.calorias
      return { emoji: emojiDe({ descripcion: f.descripcion, emoji: f.emoji, calorias: f.calorias, proteinas: f.proteinas, carbohidratos: f.carbohidratos, grasas: f.grasas } as never), nombre: f.descripcion.trim().slice(0, 60), kcal: r0(f.calorias) }
    })
    for (const f of filas.slice(20)) kcal += f.calorias
    for (const f of filas) { tot.kcal += f.calorias; tot.proteinas += f.proteinas; tot.carbohidratos += f.carbohidratos; tot.grasas += f.grasas }
    grupos.push({ tipo, nombre: (a.nombresTipo?.[tipo]?.trim() || NOMBRES_TIPO[tipo]).slice(0, 24), items, kcal: r0(kcal) })
  }
  const d: DiaCompartido = {
    fecha: a.fecha,
    grupos,
    kcal: r0(tot.kcal),
    macros: { proteinas: r1(tot.proteinas), carbohidratos: r1(tot.carbohidratos), grasas: r1(tot.grasas) },
    aguaMl: Math.max(0, r0(a.aguaMl ?? 0)),
    metaAguaMl: a.metaAguaMl && a.metaAguaMl > 0 ? r0(a.metaAguaMl) : 2000,
    logros: (a.logros ?? []).slice(0, 4).map((l) => ({ titulo: l.titulo.slice(0, 40), emoji: EMOJI_LOGRO[l.icono] ?? '🏆' })),
  }
  const nombre = primerNombre(a.nombre)
  if (nombre) d.nombre = nombre
  if (a.metaKcal && a.metaKcal > 0) d.metaKcal = r0(a.metaKcal)
  if (a.metaMacros && (a.metaMacros.proteinas || a.metaMacros.carbohidratos || a.metaMacros.grasas)) d.metaMacros = { proteinas: r0(a.metaMacros.proteinas), carbohidratos: r0(a.metaMacros.carbohidratos), grasas: r0(a.metaMacros.grasas) }
  if (a.pesoKg && a.pesoKg > 0) d.pesoKg = r1(a.pesoKg)
  if (a.racha && a.racha > 0) d.racha = a.racha
  return d
}

/** Quita lo que el usuario no quiere enseñar. Lo que no sale en la tarjeta tampoco sale en el enlace. */
export function aplicarPrivacidad(d: DiaCompartido, o: OpcionesPrivacidad): DiaCompartido {
  const out: DiaCompartido = structuredClone(d)
  if (!o.mostrarNombre) delete out.nombre
  if (o.ocultarKcal) {
    delete out.kcal
    delete out.metaKcal
    for (const g of out.grupos) { delete g.kcal; for (const i of g.items) delete i.kcal }
  }
  if (o.ocultarPesoRacha) { delete out.pesoKg; delete out.racha }
  if (o.soloEmojis) for (const g of out.grupos) for (const i of g.items) { delete i.nombre; delete i.kcal }
  return out
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
/** «sábado, 24 de octubre de 2026» (sin depender de Intl ni de la zona del servidor). */
export function fechaTexto(f: string, conAnio = true): string {
  const [y, m, d] = f.split('-').map(Number) as [number, number, number]
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return `${DIAS[dow]}, ${d} de ${MESES[m - 1]}${conAnio ? ` de ${y}` : ''}`
}

const miles = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
export const litrosTexto = (ml: number) => `${(Math.round(ml / 100) / 10).toString().replace('.', ',')} L`

/** Línea de totales: «1.840 / 2.100 kcal · P 120 g · C 180 g · G 60 g». */
export function lineaTotales(d: DiaCompartido): string {
  const partes: string[] = []
  if (d.kcal !== undefined) partes.push(d.metaKcal ? `${miles(d.kcal)} / ${miles(d.metaKcal)} kcal` : `${miles(d.kcal)} kcal`)
  partes.push(`P ${r0(d.macros.proteinas)} g`, `C ${r0(d.macros.carbohidratos)} g`, `G ${r0(d.macros.grasas)} g`)
  return partes.join(' · ')
}

/** Texto para pegar en WhatsApp/Telegram: lista con emojis. */
export function textoDia(d: DiaCompartido, url?: string): string {
  const l: string[] = [`🌱 Mi día en NutriFit · ${fechaTexto(d.fecha, false)}${d.nombre ? ` (${d.nombre})` : ''}`, '']
  for (const g of d.grupos) {
    l.push(`${EMOJI_TIPO[g.tipo]} ${g.nombre}${g.kcal !== undefined ? ` · ${miles(g.kcal)} kcal` : ''}`)
    const conNombre = g.items.some((i) => i.nombre)
    if (conNombre) for (const i of g.items) l.push(`  ${i.emoji} ${i.nombre ?? ''}${i.kcal !== undefined ? ` (${miles(i.kcal)} kcal)` : ''}`.trimEnd())
    else l.push(`  ${g.items.map((i) => i.emoji).join(' ')}`)
  }
  if (!d.grupos.length) l.push('Sin comidas apuntadas')
  l.push('', `📊 ${lineaTotales(d)}`, `💧 ${litrosTexto(d.aguaMl)} de ${litrosTexto(d.metaAguaMl)}`)
  if (d.pesoKg) l.push(`⚖️ ${String(d.pesoKg).replace('.', ',')} kg`)
  if (d.racha) l.push(`🔥 Racha de ${d.racha} ${d.racha === 1 ? 'día' : 'días'}`)
  for (const lo of d.logros) l.push(`${lo.emoji} Logro: ${lo.titulo}`)
  if (url) l.push('', url)
  return l.join('\n')
}

/** Resumen corto para og:description (máx. ~200 caracteres). */
export function descripcionDia(d: DiaCompartido): string {
  const emojis = d.grupos.flatMap((g) => g.items.map((i) => i.emoji)).slice(0, 12).join('')
  const partes = [`${d.grupos.length} ${d.grupos.length === 1 ? 'comida' : 'comidas'}${emojis ? ` ${emojis}` : ''}`, lineaTotales(d), `💧 ${litrosTexto(d.aguaMl)}`]
  if (d.racha) partes.push(`🔥 ${d.racha} ${d.racha === 1 ? 'día' : 'días'} de racha`)
  return partes.join(' · ').slice(0, 200)
}

export const tituloDia = (d: DiaCompartido) => `${d.nombre ? `El día de ${d.nombre}` : 'Mi día'} en NutriFit · ${fechaTexto(d.fecha, false)}`

/* ── Enlaces públicos ── */

export const TOKEN_RE = /^[A-Za-z0-9_-]{22}$/
/** 16 bytes aleatorios en base64url (128 bits): imposible de adivinar. */
export function nuevoToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(16))
  let s = ''
  for (const x of b) s += String.fromCharCode(x)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export type Caducidad = '1d' | '7d' | '30d' | 'nunca'
/** Fecha ISO de caducidad (null = nunca). */
export function expiraEn(c: Caducidad, ahora = new Date()): string | null {
  const dias = c === '1d' ? 1 : c === '7d' ? 7 : c === '30d' ? 30 : 0
  return dias ? new Date(ahora.getTime() + dias * 86400_000).toISOString() : null
}

export type EstadoEnlace = 'activo' | 'caducado' | 'revocado'
export function estadoEnlace(f: { expira_en: string | null; revocado_en: string | null }, ahora = new Date()): EstadoEnlace {
  if (f.revocado_en) return 'revocado'
  if (f.expira_en && new Date(f.expira_en).getTime() <= ahora.getTime()) return 'caducado'
  return 'activo'
}

export const OG_ANCHO = 1200
export const OG_ALTO = 630
export const OG_MAX_BYTES = 300 * 1024

/** PNG válido de 1200×630 y < 300 KB (firma + cabecera IHDR). Si no, se rechaza. */
export function validarPngOg(b: Uint8Array): boolean {
  if (b.length < 33 || b.length > OG_MAX_BYTES) return false
  const firma = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (!firma.every((x, i) => b[i] === x)) return false
  if (String.fromCharCode(b[12]!, b[13]!, b[14]!, b[15]!) !== 'IHDR') return false
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
  return dv.getUint32(16) === OG_ANCHO && dv.getUint32(20) === OG_ALTO
}

export function base64ABytes(s: string): Uint8Array {
  const bin = atob(s.replace(/^data:image\/png;base64,/, ''))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** Instantánea guardada → objeto tipado (descarta JSON corrupto). */
export function leerDia(json: string): DiaCompartido | null {
  try {
    const d = JSON.parse(json) as DiaCompartido
    return d && typeof d.fecha === 'string' && Array.isArray(d.grupos) ? d : null
  } catch {
    return null
  }
}

/* ── Página pública ── */

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const LOGO_SVG = '<svg width="40" height="40" viewBox="0 0 48 48" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M34.04 13.1A15 15 0 0 1 33.72 35.67 M30.2 37.91A15 15 0 0 1 10.88 31.52" stroke="#10B981"/><path d="M9.38 27.62A15 15 0 0 1 13.96 13.1" stroke="#0F172A"/><path d="M24 28.25V16.25" stroke="#10B981"/><path d="M24 19.75C24 16.25 21.5 13.75 18 13.75C18 17.25 20.5 19.75 24 19.75Z M24 16.25C24 11.75 27 8.75 31.5 8.75C31.5 13.25 28.5 16.25 24 16.25Z" stroke="#10B981"/></svg>'

function cabeza(a: { titulo: string; descripcion: string; url: string; imagen: string; alt: string; origen: string }): string {
  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(a.titulo)}</title>
<meta name="description" content="${esc(a.descripcion)}">
<meta name="robots" content="noindex, nofollow, noarchive">
<meta name="theme-color" content="#10B981">
<link rel="icon" href="${a.origen}/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="${a.origen}/icons/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="NutriFit">
<meta property="og:locale" content="es_ES">
<meta property="og:title" content="${esc(a.titulo)}">
<meta property="og:description" content="${esc(a.descripcion)}">
<meta property="og:url" content="${esc(a.url)}">
<meta property="og:image" content="${esc(a.imagen)}">
<meta property="og:image:secure_url" content="${esc(a.imagen)}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(a.alt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(a.titulo)}">
<meta name="twitter:description" content="${esc(a.descripcion)}">
<meta name="twitter:image" content="${esc(a.imagen)}">
<meta name="twitter:image:alt" content="${esc(a.alt)}">`
}

const CSS = `*{box-sizing:border-box}body{margin:0;font-family:Outfit,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#F8FAFC;color:#0F172A;-webkit-font-smoothing:antialiased}
@font-face{font-family:Outfit;src:url(/fonts/outfit-latin-var.woff2) format("woff2");font-weight:100 900;font-display:swap}
main{max-width:34rem;margin:0 auto;padding:max(1.5rem,env(safe-area-inset-top)) 1.25rem 2.5rem}
.marca{display:flex;align-items:center;gap:.6rem;font-weight:600;font-size:1.15rem;color:#0F172A;text-decoration:none}.marca b{color:#047857;font-weight:600}
.tarjeta{background:#fff;border:1px solid #E2E8F0;border-radius:1.5rem;padding:1.5rem;margin-top:1.25rem;box-shadow:0 1px 2px rgba(15,23,42,.04)}
h1{font-size:1.5rem;letter-spacing:-.02em;margin:.25rem 0 0}.sub{color:#64748B;margin:0;font-size:.95rem}.sub::first-letter{text-transform:uppercase}
.totales{display:flex;align-items:center;gap:1.25rem;margin-top:1.25rem}.anillo{flex:none}
.kcal{font-size:2rem;font-weight:600;letter-spacing:-.03em;line-height:1}.meta{color:#64748B;font-size:.9rem}
.macros{display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem;margin-top:1rem}.macro{background:#F8FAFC;border-radius:1rem;padding:.6rem .75rem}.macro small{display:block;color:#64748B;font-size:.75rem}.macro strong{font-size:1.05rem}
h2{font-size:1rem;margin:1.25rem 0 .5rem;display:flex;justify-content:space-between}h2 span{color:#64748B;font-weight:500;font-size:.9rem}
ul{list-style:none;margin:0;padding:0}li{display:flex;gap:.6rem;align-items:center;padding:.35rem 0;border-bottom:1px solid #F1F5F9}li:last-child{border:0}li .e{font-size:1.35rem;width:1.8rem;text-align:center}li .k{margin-left:auto;color:#64748B;font-size:.9rem;white-space:nowrap}
.emojis{font-size:1.6rem;letter-spacing:.2rem}
.chips{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:1.25rem}.chip{background:#ECFDF5;color:#065F46;border-radius:999px;padding:.35rem .75rem;font-size:.85rem}
.cta{display:block;text-align:center;margin-top:1.5rem;background:#0F172A;color:#fff;border-radius:999px;padding:.85rem 1rem;font-weight:600;text-decoration:none}
.pie{color:#94A3B8;font-size:.8rem;text-align:center;margin-top:1rem}`

function anilloSvg(kcal: number | undefined, meta: number | undefined): string {
  const r = 34
  const c = 2 * Math.PI * r
  const p = kcal !== undefined && meta ? Math.min(1, kcal / meta) : 1
  const color = kcal !== undefined && meta && kcal > meta * 1.1 ? '#F59E0B' : '#10B981'
  return `<svg class="anillo" width="84" height="84" viewBox="0 0 84 84" aria-hidden="true"><circle cx="42" cy="42" r="${r}" fill="none" stroke="#E2E8F0" stroke-width="8"/><circle cx="42" cy="42" r="${r}" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - p)).toFixed(1)}" transform="rotate(-90 42 42)"/><g transform="translate(26 26) scale(.6667)">${LOGO_SVG.replace(/<svg[^>]*>|<\/svg>/g, '')}</g></svg>`
}

/** HTML de la página pública de un día compartido (sin JS, sin cookies, noindex). */
export function paginaDia(d: DiaCompartido, a: { url: string; imagen: string; origen: string }): string {
  const titulo = tituloDia(d)
  const descripcion = descripcionDia(d)
  const grupos = d.grupos.map((g) => {
    const conNombre = g.items.some((i) => i.nombre)
    const cuerpo = conNombre
      ? `<ul>${g.items.map((i) => `<li><span class="e">${esc(i.emoji)}</span><span>${esc(i.nombre ?? '')}</span>${i.kcal !== undefined ? `<span class="k">${miles(i.kcal)} kcal</span>` : ''}</li>`).join('')}</ul>`
      : `<p class="emojis" aria-label="${g.items.length} alimentos">${g.items.map((i) => esc(i.emoji)).join(' ')}</p>`
    return `<h2>${EMOJI_TIPO[g.tipo]} ${esc(g.nombre)}${g.kcal !== undefined ? `<span>${miles(g.kcal)} kcal</span>` : ''}</h2>${cuerpo}`
  }).join('')
  const chips = [
    `💧 ${litrosTexto(d.aguaMl)} de ${litrosTexto(d.metaAguaMl)}`,
    ...(d.pesoKg ? [`⚖️ ${String(d.pesoKg).replace('.', ',')} kg`] : []),
    ...(d.racha ? [`🔥 ${d.racha} ${d.racha === 1 ? 'día' : 'días'} de racha`] : []),
    ...d.logros.map((l) => `${l.emoji} ${l.titulo}`),
  ].map((c) => `<span class="chip">${esc(c)}</span>`).join('')
  const mm = (k: keyof Macros, n: string) => `<div class="macro"><small>${n}</small><strong>${r0(d.macros[k])} g</strong>${d.metaMacros?.[k] ? `<small>de ${d.metaMacros[k]} g</small>` : ''}</div>`
  return `<!doctype html><html lang="es"><head>${cabeza({ titulo, descripcion, url: a.url, imagen: a.imagen, alt: `Resumen del día: ${descripcion}`, origen: a.origen })}<style>${CSS}</style></head>
<body><main><a class="marca" href="${a.origen}/">${LOGO_SVG}<span>Nutri<b>Fit</b></span></a>
<article class="tarjeta"><p class="sub">${esc(fechaTexto(d.fecha))}</p><h1>${esc(d.nombre ? `El día de ${d.nombre}` : 'Mi día')}</h1>
<div class="totales">${anilloSvg(d.kcal, d.metaKcal)}<div>${d.kcal !== undefined ? `<div class="kcal">${miles(d.kcal)} kcal</div>${d.metaKcal ? `<div class="meta">de ${miles(d.metaKcal)} kcal de objetivo</div>` : ''}` : '<div class="meta">Calorías ocultas</div>'}</div></div>
<div class="macros">${mm('proteinas', 'Proteínas')}${mm('carbohidratos', 'Carbohidratos')}${mm('grasas', 'Grasas')}</div>
${grupos || '<p class="sub" style="margin-top:1rem">Sin comidas apuntadas.</p>'}<div class="chips">${chips}</div></article>
<a class="cta" href="${a.origen}/">Prueba NutriFit gratis</a><p class="pie">Enlace de solo lectura. Sin fotos ni datos personales.</p></main></body></html>`
}

/** Página para un enlace caducado, revocado o inexistente (410/404). */
export function paginaNoDisponible(origen: string, motivo: 'caducado' | 'revocado' | 'inexistente'): string {
  const t = motivo === 'inexistente' ? 'Este enlace no existe' : motivo === 'caducado' ? 'Este enlace ha caducado' : 'Este enlace ya no está disponible'
  return `<!doctype html><html lang="es"><head>${cabeza({ titulo: `${t} · NutriFit`, descripcion: 'El día compartido ya no está disponible.', url: `${origen}/`, imagen: `${origen}/og/compartir.png`, alt: 'NutriFit', origen })}<style>${CSS}</style></head>
<body><main><a class="marca" href="${origen}/">${LOGO_SVG}<span>Nutri<b>Fit</b></span></a><article class="tarjeta"><h1>${t}</h1><p class="sub" style="margin-top:.5rem">Quien lo compartió puede haberlo retirado o haber puesto una fecha de caducidad.</p></article><a class="cta" href="${origen}/">Conoce NutriFit</a></main></body></html>`
}
