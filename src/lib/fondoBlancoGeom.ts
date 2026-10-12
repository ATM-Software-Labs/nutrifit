/** Geometría pura de máscaras y recortes (sin DOM, testeable). */
export interface Caja { x: number; y: number; w: number; h: number }

/** Caja del área con confianza > umbral y fracción de píxeles cubiertos. */
export function cajaDeMascara(m: ArrayLike<number>, w: number, h: number, umbral = 0.5): { caja: Caja | null; fraccion: number } {
  let x0 = w, y0 = h, x1 = -1, y1 = -1, n = 0
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (m[y * w + x] > umbral) { n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
  }
  return { caja: n ? { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 } : null, fraccion: n / (w * h) }
}

/** ¿La máscara parece un plato/envase razonable? */
export function mascaraValida(fraccion: number) { return fraccion >= 0.04 && fraccion <= 0.92 }

/** Amplía la caja con margen y la ajusta a la imagen. */
export function conMargen(c: Caja, w: number, h: number, margen = 0.06): Caja {
  const m = Math.round(Math.max(c.w, c.h) * margen)
  const x = Math.max(0, c.x - m), y = Math.max(0, c.y - m)
  return { x, y, w: Math.min(w, c.x + c.w + m) - x, h: Math.min(h, c.y + c.h + m) - y }
}

/** Recorte central cuadrado (80 % del lado menor), coincide con la guía de encuadre. */
export function recorteCentral(w: number, h: number, f = 0.8): Caja {
  const l = Math.round(Math.min(w, h) * f)
  return { x: Math.round((w - l) / 2), y: Math.round((h - l) / 2), w: l, h: l }
}


/** Componente conexa (4-vecinos) de la máscara binaria que contiene (px, py). */
export function componenteEn(m: ArrayLike<number>, w: number, h: number, px: number, py: number, umbral = 0.5): Uint8Array | null {
  const ini = py * w + px
  if (!(m[ini] > umbral)) return null
  const sel = new Uint8Array(w * h)
  const pila = new Int32Array(w * h)
  let n = 0
  pila[n++] = ini; sel[ini] = 1
  while (n) {
    const i = pila[--n], x = i % w
    const vec = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]
    for (const j of vec) if (j >= 0 && j < w * h && !sel[j] && m[j] > umbral) { sel[j] = 1; pila[n++] = j }
  }
  return sel
}

/** Bordes de la imagen que toca la caja (0–4). Un plato rara vez toca más de uno. */
export function bordesTocados(c: Caja, w: number, h: number, tol = Math.max(2, Math.round(Math.min(w, h) * 0.02))): number {
  return Number(c.x <= tol) + Number(c.y <= tol) + Number(c.x + c.w >= w - tol) + Number(c.y + c.h >= h - tol)
}

/** Puntuación de un candidato; null si no parece un objeto (mesa, pared, fondo). */
export function puntuarCandidato(c: Caja | null, fraccion: number, w: number, h: number): number | null {
  if (!c || fraccion < 0.04 || fraccion > 0.6) return null
  if (bordesTocados(c, w, h) > 1) return null
  const relleno = (fraccion * w * h) / (c.w * c.h)
  if (relleno < 0.45) return null
  return Math.sqrt(fraccion) * relleno * relleno
}

export const contiene = (c: Caja, x: number, y: number) => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h
