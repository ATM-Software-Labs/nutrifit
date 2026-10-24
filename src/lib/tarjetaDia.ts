/**
 * Tarjeta «Compartir mi día» dibujada en el cliente (Canvas 2D, sin dependencias).
 * Formatos: historia 1080×1920, cuadrado 1080×1080, og 1200×630 (vista previa del enlace)
 * y pdf (A4 a 150 ppp, se incrusta como JPEG en un PDF de una página).
 * Estilo nórdico: blanco/pizarra, menta #10B981, anillo de macros con el brote del logo.
 * Nunca se dibujan fotos: cada comida es su emoji.
 */
import { EMOJI_TIPO, fechaTexto, litrosTexto, type DiaCompartido, type GrupoDia } from '../../functions/utils/compartir.ts'

export type FormatoTarjeta = 'historia' | 'cuadrado' | 'og' | 'pdf'
export const MEDIDAS: Record<FormatoTarjeta, [number, number]> = { historia: [1080, 1920], cuadrado: [1080, 1080], og: [1200, 630], pdf: [1240, 1754] }

const C = {
  fondo: '#F8FAFC', tarjeta: '#FFFFFF', borde: '#E2E8F0', linea: '#F1F5F9', texto: '#0F172A', suave: '#64748B', tenue: '#94A3B8',
  menta: '#10B981', mentaOsc: '#047857', mentaClara: '#ECFDF5', pista: '#E2E8F0',
  p: '#EF4444', c: '#3B82F6', g: '#F59E0B', agua: '#0EA5E9', exceso: '#F59E0B',
}
const FUENTE = 'Outfit, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
const EMOJI = '"Apple Color Emoji", "Noto Color Emoji", "Segoe UI Emoji", sans-serif'
const miles = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
const mayus = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Carga Outfit antes de dibujar (si no, el canvas usa la fuente del sistema). */
export async function prepararFuentes(): Promise<void> {
  try {
    await Promise.all([document.fonts.load(`400 40px Outfit`), document.fonts.load(`600 40px Outfit`), document.fonts.load(`40px ${EMOJI}`, '🍎')])
  } catch { /* sin Font Loading API: fuente del sistema */ }
}

type Ctx = CanvasRenderingContext2D

function fuente(ctx: Ctx, px: number, peso = 400) { ctx.font = `${peso} ${px}px ${FUENTE}` }
function emoji(ctx: Ctx, e: string, x: number, y: number, px: number) {
  ctx.save(); ctx.font = `${px}px ${EMOJI}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.fillText(e, x, y); ctx.restore()
}
/** Recorta con «…» para que quepa en `max` px. */
function cortar(ctx: Ctx, t: string, max: number): string {
  if (ctx.measureText(t).width <= max) return t
  let s = t
  while (s.length > 1 && ctx.measureText(s + '…').width > max) s = s.slice(0, -1)
  return s.trimEnd() + '…'
}
function rrect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r)
}

/* Logo (brote dentro de un anillo abierto), viewBox 48. */
const LOGO_ANILLO = ['M34.04 13.1A15 15 0 0 1 33.72 35.67', 'M30.2 37.91A15 15 0 0 1 10.88 31.52']
const LOGO_ARCO = 'M9.38 27.62A15 15 0 0 1 13.96 13.1'
const LOGO_BROTE = ['M24 28.25V16.25', 'M24 19.75C24 16.25 21.5 13.75 18 13.75C18 17.25 20.5 19.75 24 19.75Z', 'M24 16.25C24 11.75 27 8.75 31.5 8.75C31.5 13.25 28.5 16.25 24 16.25Z']
function logo(ctx: Ctx, x: number, y: number, tam: number, soloBrote = false) {
  ctx.save(); ctx.translate(x, y); ctx.scale(tam / 48, tam / 48)
  ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  if (!soloBrote) {
    ctx.strokeStyle = C.menta; for (const d of LOGO_ANILLO) ctx.stroke(new Path2D(d))
    ctx.strokeStyle = C.texto; ctx.stroke(new Path2D(LOGO_ARCO))
  }
  ctx.strokeStyle = C.menta; ctx.fillStyle = C.mentaClara
  for (const d of LOGO_BROTE) { const p = new Path2D(d); if (d.endsWith('Z')) ctx.fill(p); ctx.stroke(p) }
  ctx.restore()
}
function marca(ctx: Ctx, x: number, y: number, u: number) {
  logo(ctx, x, y - 30 * u, 60 * u)
  fuente(ctx, 34 * u, 600); ctx.textBaseline = 'middle'; ctx.textAlign = 'left'
  ctx.fillStyle = C.texto; ctx.fillText('Nutri', x + 72 * u, y)
  const w = ctx.measureText('Nutri').width
  ctx.fillStyle = C.mentaOsc; ctx.fillText('Fit', x + 72 * u + w, y)
}

/**
 * Anillo de macros: el arco total es kcal/objetivo y se reparte en P/C/G según las kcal
 * que aporta cada macro. En el centro, el brote y las kcal.
 */
function anillo(ctx: Ctx, d: DiaCompartido, cx: number, cy: number, r: number, grosor: number, u: number) {
  ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = grosor
  ctx.strokeStyle = C.pista; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()
  const kp = d.macros.proteinas * 4, kc = d.macros.carbohidratos * 4, kg = d.macros.grasas * 9
  const totMacros = kp + kc + kg
  const prog = d.kcal !== undefined && d.metaKcal ? Math.min(1, d.kcal / d.metaKcal) : totMacros > 0 ? 1 : 0
  if (prog > 0 && totMacros > 0) {
    const inicio = -Math.PI / 2
    const total = Math.PI * 2 * prog
    const hueco = Math.min(0.06, total / 20) + grosor / r / 2
    let a = inicio
    for (const [k, col] of [[kp, C.p], [kc, C.c], [kg, C.g]] as const) {
      const ang = (k / totMacros) * total
      if (ang <= 0.001) continue
      ctx.strokeStyle = col; ctx.beginPath()
      const fin = a + ang
      ctx.arc(cx, cy, r, a + (ang > hueco * 2 ? hueco / 2 : 0), fin - (ang > hueco * 2 ? hueco / 2 : 0)); ctx.stroke()
      a = fin
    }
  }
  ctx.restore()
  // Centro: brote + kcal
  const tamLogo = r * 0.5
  logo(ctx, cx - tamLogo / 2, cy - r * 0.62, tamLogo, true)
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'
  if (d.kcal !== undefined) {
    fuente(ctx, r * 0.36, 600); ctx.fillStyle = C.texto; ctx.fillText(miles(d.kcal), cx, cy + r * 0.2)
    fuente(ctx, r * 0.13, 400); ctx.fillStyle = C.suave
    ctx.fillText(d.metaKcal ? `de ${miles(d.metaKcal)} kcal` : 'kcal', cx, cy + r * 0.42)
  } else {
    fuente(ctx, r * 0.15, 500); ctx.fillStyle = C.suave; ctx.fillText('Mi día', cx, cy + r * 0.22)
  }
  void u
}

function macros(ctx: Ctx, d: DiaCompartido, x: number, y: number, w: number, u: number, alto = 120) {
  const gap = 18 * u
  const cw = (w - gap * 2) / 3
  const items = [['Proteínas', d.macros.proteinas, d.metaMacros?.proteinas, C.p], ['Carbos', d.macros.carbohidratos, d.metaMacros?.carbohidratos, C.c], ['Grasas', d.macros.grasas, d.metaMacros?.grasas, C.g]] as const
  items.forEach(([n, v, m, col], i) => {
    const xx = x + i * (cw + gap)
    ctx.fillStyle = C.fondo; rrect(ctx, xx, y, cw, alto * u, 24 * u); ctx.fill()
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(xx + 30 * u, y + 36 * u, 8 * u, 0, Math.PI * 2); ctx.fill()
    fuente(ctx, 24 * u, 500); ctx.fillStyle = C.suave; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(n, xx + 48 * u, y + 37 * u)
    fuente(ctx, 38 * u, 600); ctx.fillStyle = C.texto; ctx.textBaseline = 'alphabetic'
    const t = `${Math.round(v)} g`; ctx.fillText(t, xx + 22 * u, y + (alto - 26) * u)
    if (m) { const tw = ctx.measureText(t).width; fuente(ctx, 24 * u, 400); ctx.fillStyle = C.tenue; ctx.fillText(` / ${m}`, xx + 22 * u + tw, y + (alto - 26) * u) }
  })
}

/** Chips de agua, peso, racha y logros. Devuelve la altura usada. */
function chips(ctx: Ctx, d: DiaCompartido, x: number, y: number, w: number, u: number, px = 28): number {
  const lista = [
    `💧 ${litrosTexto(d.aguaMl)} / ${litrosTexto(d.metaAguaMl)}`,
    ...(d.racha ? [`🔥 ${d.racha} ${d.racha === 1 ? 'día' : 'días'} de racha`] : []),
    ...(d.pesoKg ? [`⚖️ ${String(d.pesoKg).replace('.', ',')} kg`] : []),
    ...d.logros.map((l) => `${l.emoji} ${l.titulo}`),
  ]
  const h = px * 2 * u
  let cx = x, cy = y
  for (const t of lista) {
    const [e, ...resto] = t.split(' ')
    const txt = resto.join(' ')
    fuente(ctx, px * u, 500)
    const tw = Math.min(ctx.measureText(txt).width, w - px * 3 * u)
    const cw = tw + px * 2.9 * u
    if (cx + cw > x + w && cx > x) { cx = x; cy += h + 14 * u }
    ctx.fillStyle = e === '💧' ? '#F0F9FF' : C.mentaClara; rrect(ctx, cx, cy, cw, h, h / 2); ctx.fill()
    emoji(ctx, e!, cx + px * 1.05 * u, cy + h / 2 + 1 * u, px * 0.95 * u)
    ctx.fillStyle = e === '💧' ? '#075985' : '#065F46'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    ctx.fillText(cortar(ctx, txt, tw), cx + px * 1.9 * u, cy + h / 2 + 1 * u)
    cx += cw + 12 * u
  }
  return lista.length ? cy + h - y : 0
}

/** Lista de comidas por tipo. Encoge líneas si no cabe y resume con «+N más». */
function comidas(ctx: Ctx, grupos: GrupoDia[], x: number, y: number, w: number, hMax: number, u: number, base = 34) {
  if (!grupos.length) {
    fuente(ctx, base * u, 400); ctx.fillStyle = C.suave; ctx.textAlign = 'left'; ctx.textBaseline = 'top'
    ctx.fillText('Sin comidas apuntadas', x, y); return
  }
  const soloEmoji = grupos.every((g) => g.items.every((i) => !i.nombre))
  const lineas = (esc: number) => {
    const cab = base * 1.9 * esc, fila = base * 1.55 * esc, sep = base * 0.7 * esc
    let total = 0
    for (const g of grupos) total += cab + (soloEmoji ? base * 1.9 * esc * Math.ceil(g.items.length / Math.max(1, Math.floor(w / (base * 1.75 * esc)))) : g.items.length * fila) + sep
    return total
  }
  let esc = 1
  while (esc > 0.62 && lineas(esc) > hMax) esc -= 0.04
  const maxFilas = (restante: number) => Math.max(1, Math.floor(restante / (base * 1.55 * esc)))
  let cy = y
  for (const g of grupos) {
    const cab = base * 1.9 * esc
    if (cy + cab > y + hMax) break
    emoji(ctx, EMOJI_TIPO[g.tipo], x + base * 0.6 * esc * u, cy + cab / 2, base * 0.95 * esc * u)
    fuente(ctx, base * 0.95 * esc * u, 600); ctx.fillStyle = C.texto; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    ctx.fillText(g.nombre, x + base * 1.45 * esc * u, cy + cab / 2)
    if (g.kcal !== undefined) { fuente(ctx, base * 0.8 * esc * u, 500); ctx.fillStyle = C.suave; ctx.textAlign = 'right'; ctx.fillText(`${miles(g.kcal)} kcal`, x + w, cy + cab / 2) }
    cy += cab
    if (soloEmoji) {
      const tam = base * 1.75 * esc * u
      const porFila = Math.max(1, Math.floor(w / tam))
      g.items.forEach((it, i) => emoji(ctx, it.emoji, x + tam / 2 + (i % porFila) * tam, cy + base * 0.95 * esc * u + Math.floor(i / porFila) * base * 1.9 * esc * u, base * 1.3 * esc * u))
      cy += base * 1.9 * esc * u * Math.ceil(g.items.length / porFila)
    } else {
      const fila = base * 1.55 * esc * u
      const caben = maxFilas(y + hMax - cy)
      const vis = g.items.length > caben ? g.items.slice(0, Math.max(0, caben - 1)) : g.items
      for (const it of vis) {
        emoji(ctx, it.emoji, x + base * 0.6 * esc * u, cy + fila / 2, base * 0.95 * esc * u)
        fuente(ctx, base * 0.85 * esc * u, 400); ctx.fillStyle = C.texto; ctx.textAlign = 'left'
        const kc = it.kcal !== undefined ? `${miles(it.kcal)}` : ''
        fuente(ctx, base * 0.8 * esc * u, 400)
        const kw = kc ? ctx.measureText(kc).width + 16 * u : 0
        fuente(ctx, base * 0.85 * esc * u, 400)
        ctx.fillText(cortar(ctx, it.nombre ?? '', w - base * 1.45 * esc * u - kw), x + base * 1.45 * esc * u, cy + fila / 2)
        if (kc) { fuente(ctx, base * 0.8 * esc * u, 400); ctx.fillStyle = C.tenue; ctx.textAlign = 'right'; ctx.fillText(kc, x + w, cy + fila / 2) }
        cy += fila
      }
      if (vis.length < g.items.length) {
        fuente(ctx, base * 0.8 * esc * u, 500); ctx.fillStyle = C.suave; ctx.textAlign = 'left'
        ctx.fillText(`+${g.items.length - vis.length} más`, x + base * 1.45 * esc * u, cy + fila / 2); cy += fila
      }
    }
    cy += base * 0.7 * esc * u
  }
}

function cabecera(ctx: Ctx, d: DiaCompartido, x: number, y: number, u: number, tamTitulo = 76) {
  fuente(ctx, 30 * u, 500); ctx.fillStyle = C.suave; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
  ctx.fillText(mayus(fechaTexto(d.fecha)), x, y)
  fuente(ctx, tamTitulo * u, 600); ctx.fillStyle = C.texto
  ctx.fillText(d.nombre ? `El día de ${d.nombre}` : 'Mi día', x, y + tamTitulo * 1.1 * u)
}

function pie(ctx: Ctx, W: number, y: number, u: number) {
  fuente(ctx, 26 * u, 500); ctx.fillStyle = C.tenue; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText('nutri.trujillomingorance.com', W / 2, y)
}

function fondo(ctx: Ctx, W: number, H: number) {
  ctx.fillStyle = C.fondo; ctx.fillRect(0, 0, W, H)
  // halo menta muy suave arriba a la derecha
  const g = ctx.createRadialGradient(W * 0.9, 0, 0, W * 0.9, 0, W * 0.8)
  g.addColorStop(0, 'rgba(16,185,129,0.14)'); g.addColorStop(1, 'rgba(16,185,129,0)')
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
}
function panel(ctx: Ctx, x: number, y: number, w: number, h: number, u: number) {
  ctx.save(); ctx.shadowColor = 'rgba(15,23,42,0.06)'; ctx.shadowBlur = 30 * u; ctx.shadowOffsetY = 8 * u
  ctx.fillStyle = C.tarjeta; rrect(ctx, x, y, w, h, 44 * u); ctx.fill(); ctx.restore()
  ctx.strokeStyle = C.borde; ctx.lineWidth = 2 * u; rrect(ctx, x, y, w, h, 44 * u); ctx.stroke()
}

function historia(ctx: Ctx, d: DiaCompartido) {
  const W = 1080, H = 1920, u = 1, m = 72
  fondo(ctx, W, H)
  marca(ctx, m, 130, u)
  cabecera(ctx, d, m, 250, u, 84)
  panel(ctx, m - 16, 370, W - 2 * m + 32, H - 370 - 150, u)
  anillo(ctx, d, W / 2, 620, 190, 34, u)
  macros(ctx, d, m + 24, 860, W - 2 * m - 48, u)
  ctx.strokeStyle = C.linea; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(m + 24, 1020); ctx.lineTo(W - m - 24, 1020); ctx.stroke()
  // chips abajo: se miden primero para dejar sitio a la lista
  const off = document.createElement('canvas').getContext('2d')!
  const hChips = chips(off, d, m + 24, 0, W - 2 * m - 48, u)
  const yChips = H - 150 - 40 - hChips
  comidas(ctx, d.grupos, m + 24, 1050, W - 2 * m - 48, yChips - 1050 - 30, u, 36)
  chips(ctx, d, m + 24, yChips, W - 2 * m - 48, u)
  pie(ctx, W, H - 80, u)
}

function cuadrado(ctx: Ctx, d: DiaCompartido) {
  const W = 1080, H = 1080, u = 1, m = 56
  fondo(ctx, W, H)
  marca(ctx, m, 92, 0.85)
  fuente(ctx, 26, 500); ctx.fillStyle = C.suave; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
  ctx.fillText(mayus(fechaTexto(d.fecha, false)), W - m, 92)
  panel(ctx, m, 150, W - 2 * m, H - 150 - 100, u)
  // izquierda: título, anillo y macros en columna
  const colW = 400
  fuente(ctx, 48, 600); ctx.fillStyle = C.texto; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
  ctx.fillText(cortar(ctx, d.nombre ? `El día de ${d.nombre}` : 'Mi día', colW), m + 40, 228)
  anillo(ctx, d, m + 40 + colW / 2, 430, 150, 28, u)
  const items = [['Proteínas', d.macros.proteinas, C.p], ['Carbos', d.macros.carbohidratos, C.c], ['Grasas', d.macros.grasas, C.g]] as const
  items.forEach(([n, v, col], i) => {
    const y = 640 + i * 62
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(m + 56, y, 9, 0, Math.PI * 2); ctx.fill()
    fuente(ctx, 28, 500); ctx.fillStyle = C.suave; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(n, m + 78, y)
    fuente(ctx, 30, 600); ctx.fillStyle = C.texto; ctx.textAlign = 'right'; ctx.fillText(`${Math.round(v)} g`, m + 40 + colW, y)
  })
  // derecha: comidas
  const xR = m + 40 + colW + 48, wR = W - m - 40 - xR
  ctx.strokeStyle = C.linea; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(xR - 24, 190); ctx.lineTo(xR - 24, 800); ctx.stroke()
  comidas(ctx, d.grupos, xR, 190, wR, 620, u, 28)
  chips(ctx, d, m + 40, 840, W - 2 * m - 80, u, 25)
  pie(ctx, W, H - 50, 0.9)
}

function og(ctx: Ctx, d: DiaCompartido) {
  const W = 1200, H = 630, u = 1
  fondo(ctx, W, H)
  panel(ctx, 40, 40, W - 80, H - 80, 0.8)
  marca(ctx, 84, 104, 0.8)
  fuente(ctx, 26, 500); ctx.fillStyle = C.suave; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
  ctx.fillText(mayus(fechaTexto(d.fecha)), 84, 178)
  fuente(ctx, 56, 600); ctx.fillStyle = C.texto
  ctx.fillText(cortar(ctx, d.nombre ? `El día de ${d.nombre}` : 'Mi día', 460), 84, 242)
  anillo(ctx, d, 290, 418, 118, 24, u)
  // derecha: comidas en filas de emojis + macros
  const x = 560, w = W - 84 - x
  let y = 96
  for (const g of d.grupos.slice(0, 4)) {
    emoji(ctx, EMOJI_TIPO[g.tipo], x + 18, y + 22, 30)
    fuente(ctx, 30, 600); ctx.fillStyle = C.texto; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(g.nombre, x + 48, y + 22)
    if (g.kcal !== undefined) { fuente(ctx, 26, 500); ctx.fillStyle = C.suave; ctx.textAlign = 'right'; ctx.fillText(`${miles(g.kcal)} kcal`, x + w, y + 22) }
    const caben = Math.floor((w - 48) / 50)
    const lista = g.items.slice(0, caben)
    lista.forEach((it, i) => emoji(ctx, it.emoji, x + 66 + i * 50, y + 72, 38))
    if (g.items.length > caben) { fuente(ctx, 24, 500); ctx.fillStyle = C.suave; ctx.textAlign = 'left'; ctx.fillText(`+${g.items.length - caben}`, x + 48 + caben * 50, y + 72) }
    y += 106
  }
  if (!d.grupos.length) { fuente(ctx, 30, 400); ctx.fillStyle = C.suave; ctx.textAlign = 'left'; ctx.fillText('Sin comidas apuntadas', x, 140) }
  const lin = [`P ${Math.round(d.macros.proteinas)} g`, `C ${Math.round(d.macros.carbohidratos)} g`, `G ${Math.round(d.macros.grasas)} g`, `💧 ${litrosTexto(d.aguaMl)}`, ...(d.racha ? [`🔥 ${d.racha}`] : [])]
  fuente(ctx, 26, 600); ctx.textBaseline = 'middle'; ctx.textAlign = 'left'
  let cx = x
  const cols = [C.p, C.c, C.g, C.agua, C.exceso]
  lin.forEach((t, i) => {
    const tw = ctx.measureText(t).width + 36
    ctx.fillStyle = C.fondo; rrect(ctx, cx, 528, tw, 48, 24); ctx.fill()
    ctx.fillStyle = cols[i]!; ctx.fillText(t, cx + 18, 553)
    cx += tw + 10
  })
}

function pdf(ctx: Ctx, d: DiaCompartido) {
  const W = 1240, H = 1754, m = 96, u = 1
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = C.menta; ctx.fillRect(0, 0, W, 10)
  marca(ctx, m, 110, 0.9)
  fuente(ctx, 24, 500); ctx.fillStyle = C.tenue; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText('Resumen del día', W - m, 110)
  cabecera(ctx, d, m, 230, u, 64)
  anillo(ctx, d, m + 170, 520, 150, 28, u)
  // tabla de totales a la derecha del anillo
  const x = m + 400, w = W - m - x
  const filas: [string, string, string, string][] = [
    ['Calorías', d.kcal !== undefined ? `${miles(d.kcal)} kcal` : '—', d.kcal !== undefined && d.metaKcal ? `${miles(d.metaKcal)} kcal` : '—', C.menta],
    ['Proteínas', `${Math.round(d.macros.proteinas)} g`, d.metaMacros ? `${d.metaMacros.proteinas} g` : '—', C.p],
    ['Carbohidratos', `${Math.round(d.macros.carbohidratos)} g`, d.metaMacros ? `${d.metaMacros.carbohidratos} g` : '—', C.c],
    ['Grasas', `${Math.round(d.macros.grasas)} g`, d.metaMacros ? `${d.metaMacros.grasas} g` : '—', C.g],
    ['Agua', litrosTexto(d.aguaMl), litrosTexto(d.metaAguaMl), C.agua],
  ]
  fuente(ctx, 22, 600); ctx.fillStyle = C.tenue; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
  ctx.fillText('CONSUMIDO', x + w - 200, 396); ctx.fillText('OBJETIVO', x + w, 396)
  filas.forEach(([n, v, o, col], i) => {
    const y = 446 + i * 58
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x + 10, y, 8, 0, Math.PI * 2); ctx.fill()
    fuente(ctx, 28, 500); ctx.fillStyle = C.texto; ctx.textAlign = 'left'; ctx.fillText(n, x + 32, y)
    fuente(ctx, 28, 600); ctx.textAlign = 'right'; ctx.fillText(v, x + w - 200, y)
    fuente(ctx, 28, 400); ctx.fillStyle = C.suave; ctx.fillText(o, x + w, y)
    ctx.strokeStyle = C.linea; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y + 29); ctx.lineTo(x + w, y + 29); ctx.stroke()
  })
  ctx.strokeStyle = C.borde; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(m, 740); ctx.lineTo(W - m, 740); ctx.stroke()
  fuente(ctx, 34, 600); ctx.fillStyle = C.texto; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText('Comidas', m, 800)
  const off = document.createElement('canvas').getContext('2d')!
  const hChips = chips(off, d, m, 0, W - 2 * m, u, 26)
  const yChips = H - 130 - hChips
  comidas(ctx, d.grupos, m, 830, W - 2 * m, yChips - 830 - 40, u, 32)
  chips(ctx, d, m, yChips, W - 2 * m, u, 26)
  fuente(ctx, 22, 400); ctx.fillStyle = C.tenue; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText('Generado con NutriFit · nutri.trujillomingorance.com · Valores orientativos, no es consejo médico.', W / 2, H - 60)
}

/** Dibuja la tarjeta en un canvas nuevo del tamaño del formato. */
export function dibujarTarjeta(d: DiaCompartido, formato: FormatoTarjeta): HTMLCanvasElement {
  const [W, H] = MEDIDAS[formato]
  const cv = document.createElement('canvas')
  cv.width = W; cv.height = H
  const ctx = cv.getContext('2d')!
  ;({ historia, cuadrado, og, pdf })[formato](ctx, d)
  return cv
}

export const aBlob = (cv: HTMLCanvasElement, tipo = 'image/png', calidad?: number) =>
  new Promise<Blob>((ok, mal) => cv.toBlob((b) => (b ? ok(b) : mal(new Error('No se pudo generar la imagen'))), tipo, calidad))

export async function aBase64(b: Blob): Promise<string> {
  const bytes = new Uint8Array(await b.arrayBuffer())
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

/* ── PDF mínimo: una página A4 con la tarjeta incrustada como JPEG (DCTDecode) ── */

const enc = new TextEncoder()
const hexUtf16 = (s: string) => {
  let h = 'FEFF'
  for (const ch of s) {
    const cp = ch.codePointAt(0)!
    const u = cp > 0xffff ? [0xd800 + ((cp - 0x10000) >> 10), 0xdc00 + ((cp - 0x10000) & 0x3ff)] : [cp]
    for (const x of u) h += x.toString(16).padStart(4, '0').toUpperCase()
  }
  return `<${h}>`
}

/** PDF 1.4 de una página A4 con una imagen JPEG a página completa. */
export function pdfDesdeJpeg(jpeg: Uint8Array, ancho: number, alto: number, titulo = 'NutriFit'): Uint8Array {
  const pw = 595.28, ph = 841.89
  const contenido = `q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`
  const partes: Uint8Array[] = []
  const offsets: number[] = []
  let len = 0
  const push = (x: string | Uint8Array) => { const b = typeof x === 'string' ? enc.encode(x) : x; partes.push(b); len += b.length }
  push('%PDF-1.4\n')
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])) // marca binaria
  const obj = (n: number, cuerpo: string | (() => void)) => {
    offsets[n] = len
    push(`${n} 0 obj\n`)
    if (typeof cuerpo === 'string') push(cuerpo)
    else cuerpo()
    push('\nendobj\n')
  }
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>')
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>')
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`)
  obj(4, () => {
    push(`<< /Type /XObject /Subtype /Image /Width ${ancho} /Height ${alto} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`)
    push(jpeg)
    push('\nendstream')
  })
  obj(5, `<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`)
  obj(6, `<< /Title ${hexUtf16(titulo)} /Producer (NutriFit) /Creator (NutriFit) >>`)
  const xref = len
  let x = `xref\n0 7\n0000000000 65535 f \n`
  for (let i = 1; i <= 6; i++) x += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  push(x)
  push(`trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`)
  const out = new Uint8Array(len)
  let o = 0
  for (const p of partes) { out.set(p, o); o += p.length }
  return out
}

export async function pdfDelDia(d: DiaCompartido): Promise<Blob> {
  const cv = dibujarTarjeta(d, 'pdf')
  const jpeg = new Uint8Array(await (await aBlob(cv, 'image/jpeg', 0.9)).arrayBuffer())
  return new Blob([pdfDesdeJpeg(jpeg, cv.width, cv.height, `NutriFit · ${fechaTexto(d.fecha)}`) as BlobPart], { type: 'application/pdf' })
}

export const nombreArchivo = (d: DiaCompartido, sufijo: string, ext: string) => `nutrifit-${d.fecha}-${sufijo}.${ext}`

export function descargar(b: Blob, nombre: string) {
  const url = URL.createObjectURL(b)
  const a = document.createElement('a')
  a.href = url; a.download = nombre; a.rel = 'noopener'
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
