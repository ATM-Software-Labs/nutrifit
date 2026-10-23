/**
 * Franjas horarias por comida (lógica pura: la usan el cron, la API y los tests).
 *
 * Cada franja es el rato en el que sueles hacer esa comida (p. ej. comida 14:00–15:30).
 * Si al final de la franja (o X min tras su inicio) no hay nada de ese tipo apuntado hoy,
 * sale UN aviso. Todo en hora local de la zona del usuario (Intl → a salvo del cambio de hora).
 *
 * Tolerancia al reloj: el aviso no exige que el cron caiga en un minuto exacto. Basta con que
 * alguna ronda pase entre el minuto de aviso y el límite (fin + GRACIA_MIN, sin pisar la
 * siguiente franja). recordatorios_envios (usuario, fecha, 'f:<id>') impide repetirlo.
 */
import { aMin, enSilencio, type AhoraLocal } from './recordatorios.ts'

export type TipoComidaFranja = 'desayuno' | 'comida' | 'cena' | 'snack'

export interface Franja {
  /** desayuno | media_manana | comida | merienda | cena | p_xxxx (propias). */
  id: string
  nombre: string
  /** Tipo del diario que la da por cumplida. */
  tipo: TipoComidaFranja
  inicio: string
  fin: string
  /** Avisar X min después del inicio (null = al final de la franja). */
  aviso_min: number | null
  /** Máscara de días: bit 0 = lunes … bit 6 = domingo. 127 = todos. */
  dias: number
  activo: boolean
  orden: number
}

export interface FilaFranja { id: string; nombre: string; tipo_comida: string; inicio: string; fin: string; aviso_min: number | null; dias: number; activo: number; orden: number }
export const franjaDeFila = (r: FilaFranja): Franja => ({ id: r.id, nombre: r.nombre, tipo: r.tipo_comida as TipoComidaFranja, inicio: r.inicio, fin: r.fin, aviso_min: r.aviso_min, dias: r.dias, activo: !!r.activo, orden: r.orden })

export const DIAS_TODOS = 127
export const DIAS_LABORABLES = 31
/** Minutos tras el fin de la franja durante los que el aviso aún vale (cubre rondas tardías o perdidas). */
export const GRACIA_MIN = 90
/** Margen mínimo garantizado para que alguna ronda lo recoja aunque la siguiente franja empiece pronto. */
export const MARGEN_MIN = 20
export const MAX_FRANJAS = 10

/** Horarios habituales en España. */
export const FRANJAS_POR_DEFECTO: readonly Franja[] = [
  { id: 'desayuno', nombre: 'Desayuno', tipo: 'desayuno', inicio: '07:30', fin: '10:00', aviso_min: null, dias: DIAS_TODOS, activo: true, orden: 0 },
  { id: 'media_manana', nombre: 'Media mañana', tipo: 'snack', inicio: '11:00', fin: '12:30', aviso_min: null, dias: DIAS_TODOS, activo: false, orden: 1 },
  { id: 'comida', nombre: 'Comida', tipo: 'comida', inicio: '14:00', fin: '15:30', aviso_min: null, dias: DIAS_TODOS, activo: true, orden: 2 },
  { id: 'merienda', nombre: 'Merienda', tipo: 'snack', inicio: '17:30', fin: '19:00', aviso_min: null, dias: DIAS_TODOS, activo: false, orden: 3 },
  { id: 'cena', nombre: 'Cena', tipo: 'cena', inicio: '21:00', fin: '22:30', aviso_min: null, dias: DIAS_TODOS, activo: true, orden: 4 },
]

/** Sin franjas guardadas: las de por defecto, activadas según las horas antiguas (una por comida). */
export function franjasEfectivas(guardadas: Franja[], legado?: { desayuno: string | null; comida: string | null; cena: string | null; snack: string | null } | null): Franja[] {
  if (guardadas.length) return [...guardadas].sort((a, b) => a.orden - b.orden || aMin(a.inicio) - aMin(b.inicio))
  return FRANJAS_POR_DEFECTO.map((f) => {
    if (!legado) return { ...f }
    const activo = f.id === 'media_manana' ? false : f.id === 'merienda' ? legado.snack !== null : legado[f.id as 'desayuno' | 'comida' | 'cena'] !== null
    return { ...f, activo }
  })
}

export const diaActivo = (dias: number, dow: number) => ((dias >> dow) & 1) === 1

/** Minuto local en el que toca avisar. */
export function minutoAviso(f: Pick<Franja, 'inicio' | 'fin' | 'aviso_min'>): number {
  const ini = aMin(f.inicio), fin = aMin(f.fin)
  return f.aviso_min === null ? fin : Math.min(ini + Math.max(0, f.aviso_min), fin)
}

/** Hasta qué minuto local se sigue enviando (exclusivo): fin + gracia, sin pisar la siguiente franja activa, nunca después de medianoche. */
export function limiteAviso(f: Franja, hoy: Franja[]): number {
  const desde = minutoAviso(f)
  let lim = Math.min(aMin(f.fin) + GRACIA_MIN, 24 * 60)
  for (const o of hoy) {
    if (o.id === f.id) continue
    const ini = aMin(o.inicio)
    if (o.activo && ini >= desde && ini < lim) lim = ini // la siguiente franja ya empezó: no pisarla
  }
  return Math.max(lim, Math.min(desde + MARGEN_MIN, 24 * 60))
}

/** Registro del diario de hoy: tipo y minuto local (null si no se sabe). */
export interface RegistroHoy { tipo: string; min: number | null }

/**
 * ¿Ya está apuntada? Si es la única franja activa de su tipo hoy, vale cualquier registro de ese tipo.
 * Si hay varias del mismo tipo (media mañana y merienda son 'snack'), cada registro cuenta para la
 * franja más cercana: el corte es el punto medio entre el fin de una y el inicio de la siguiente.
 */
export function franjaCubierta(f: Franja, hoy: Franja[], registros: RegistroHoy[]): boolean {
  const mismas = hoy.filter((o) => o.tipo === f.tipo && (o.activo || o.id === f.id)).sort((a, b) => aMin(a.inicio) - aMin(b.inicio))
  const delTipo = registros.filter((r) => r.tipo === f.tipo)
  if (mismas.length <= 1) return delTipo.length > 0
  const i = mismas.findIndex((o) => o.id === f.id)
  const prev = mismas[i - 1], sig = mismas[i + 1]
  const desde = prev ? (aMin(prev.fin) + aMin(f.inicio)) / 2 : -Infinity
  const hasta = sig ? (aMin(f.fin) + aMin(sig.inicio)) / 2 : Infinity
  return delTipo.some((r) => r.min === null || (r.min >= desde && r.min < hasta))
}

export const claveFranja = (id: string) => `f:${id}` as const
export const claveHecho = (id: string) => `h:${id}` as const
export const claveSaltada = (id: string) => `s:${id}` as const

export interface FranjaPendiente { franja: Franja; clave: `f:${string}`; titulo: string; cuerpo: string; url: string }

const TITULOS: Record<string, string> = {
  desayuno: '☕ ¿Ya has desayunado?',
  media_manana: '🍎 ¿Algo a media mañana?',
  comida: '🍽️ ¿Ya has comido?',
  merienda: '🥪 ¿Ya has merendado?',
  cena: '🌙 ¿Ya has cenado?',
}

/** Textos cortos (caben en un reloj). */
export function textoFranja(f: Franja): { titulo: string; cuerpo: string } {
  const titulo = TITULOS[f.id] ?? `🍽️ ¿${f.nombre}?`
  return { titulo, cuerpo: `${f.nombre} sin apuntar (${f.inicio}–${f.fin}).` }
}

export const urlApuntar = (f: Pick<Franja, 'tipo' | 'id'>) => `/?apuntar=${f.tipo}&franja=${encodeURIComponent(f.id)}`

/**
 * Avisos de franja que tocan ahora, en orden de hora de aviso.
 * No aplica el máximo diario (lo hace el cron junto con el resto de avisos).
 */
export function franjasPendientes(
  p: { activo: number | boolean; silencio_desde: string; silencio_hasta: string },
  franjas: Franja[],
  ahora: AhoraLocal,
  registros: RegistroHoy[],
  enviadosHoy: Set<string>,
): FranjaPendiente[] {
  if (!p.activo || enSilencio(ahora.min, p.silencio_desde, p.silencio_hasta)) return []
  const hoy = franjas.filter((f) => f.activo && diaActivo(f.dias, ahora.dow))
  return hoy
    .filter((f) => !enviadosHoy.has(claveFranja(f.id)) && !enviadosHoy.has(claveHecho(f.id)) && !enviadosHoy.has(claveSaltada(f.id)))
    .filter((f) => ahora.min >= minutoAviso(f) && ahora.min < limiteAviso(f, hoy))
    .filter((f) => !franjaCubierta(f, hoy, registros))
    .sort((a, b) => minutoAviso(a) - minutoAviso(b))
    .map((f) => ({ franja: f, clave: claveFranja(f.id), ...textoFranja(f), url: urlApuntar(f) }))
}

/* ── Sugerencias a partir del historial ── */

/** Bandas plausibles por franja (minutos locales) para filtrar apuntes hechos a otra hora (p. ej. todo por la noche). */
const BANDAS: Record<string, [number, number, TipoComidaFranja]> = {
  desayuno: [5 * 60, 12 * 60 + 30, 'desayuno'],
  media_manana: [9 * 60 + 30, 13 * 60, 'snack'],
  comida: [12 * 60, 17 * 60 + 30, 'comida'],
  merienda: [16 * 60, 20 * 60 + 30, 'snack'],
  cena: [19 * 60, 24 * 60, 'cena'],
}

export interface Sugerencia { inicio: string; fin: string; dias: number; texto: string }

const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const cuantil = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b)
  const pos = (s.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos)
  return s[lo]! + (s[hi]! - s[lo]!) * (pos - lo)
}
const VERBOS: Record<string, string> = { desayuno: 'desayunar', media_manana: 'tomar algo a media mañana', comida: 'comer', merienda: 'merendar', cena: 'cenar' }

/**
 * "Sueles comer entre 14:10 y 15:00": por día, el primer apunte de ese tipo dentro de su banda
 * (hecho el mismo día, no a posteriori); de ahí los percentiles 20–80 redondeados a 5 min.
 * Hacen falta al menos `minDias` días distintos.
 */
export function sugerirFranjas(registros: { fecha: string; tipo: string; min: number }[], minDias = 4): Record<string, Sugerencia> {
  const out: Record<string, Sugerencia> = {}
  for (const [id, [a, b, tipo]] of Object.entries(BANDAS)) {
    const primero = new Map<string, number>()
    for (const r of registros) {
      if (r.tipo !== tipo || r.min < a || r.min >= b) continue
      const prev = primero.get(r.fecha)
      if (prev === undefined || r.min < prev) primero.set(r.fecha, r.min)
    }
    const xs = [...primero.values()]
    if (xs.length < minDias) continue
    let ini = Math.floor(cuantil(xs, 0.2) / 5) * 5
    let fin = Math.ceil(cuantil(xs, 0.8) / 5) * 5
    if (fin - ini < 30) { const c = (ini + fin) / 2; ini = Math.floor((c - 15) / 5) * 5; fin = ini + 30 }
    fin = Math.min(fin, 23 * 60 + 55)
    out[id] = { inicio: hhmm(ini), fin: hhmm(fin), dias: xs.length, texto: `Sueles ${VERBOS[id]} entre ${hhmm(ini)} y ${hhmm(fin)}` }
  }
  return out
}

/** Minuto local (0–1439) y fecha local de un instante UTC 'YYYY-MM-DD HH:MM:SS' o ISO. */
export function minutoLocalDe(utc: string, zona: string): { fecha: string; min: number } | null {
  const t = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(utc) ? utc : utc.replace(' ', 'T') + 'Z')
  if (!Number.isFinite(t)) return null
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(t)).map((x) => [x.type, x.value]))
  return { fecha: `${p.year}-${p.month}-${p.day}`, min: Number(p.hour) * 60 + Number(p.minute) }
}

/** Minuto local de un apunte: su `hora` si la tiene; si no, cuándo se creó (solo si fue el mismo día). */
export function minutoDeRegistro(r: { fecha: string; hora: string | null; creado_en: string }, zona: string): number | null {
  if (r.hora && /^\d\d:\d\d/.test(r.hora)) return aMin(r.hora.slice(0, 5))
  const l = minutoLocalDe(r.creado_en, zona)
  return l && l.fecha === r.fecha ? l.min : null
}
