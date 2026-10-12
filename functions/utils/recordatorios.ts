/**
 * Lógica pura de recordatorios (la usa el Worker nutrifit-cron y los tests).
 * Un recordatorio de comida solo sale si esa comida no está registrada todavía,
 * fuera de las horas de silencio, como mucho `max_dia` al día y una vez por clave y día.
 */
export type ClaveRecordatorio = 'desayuno' | 'comida' | 'cena' | 'snack' | 'cierre' | 'agua' | 'resumen'

export interface PrefRecordatorios {
  activo: number
  zona: string
  desayuno: string | null
  comida: string | null
  cena: string | null
  snack: string | null
  cierre: string | null
  agua: number
  email: number
  resumen_semanal: number
  silencio_desde: string
  silencio_hasta: string
  max_dia: number
}

export const PREF_POR_DEFECTO: Omit<PrefRecordatorios, 'activo'> = {
  zona: 'Europe/Madrid', desayuno: '09:00', comida: '14:30', cena: '21:30', snack: null, cierre: '22:30',
  agua: 0, email: 0, resumen_semanal: 1, silencio_desde: '23:00', silencio_hasta: '08:00', max_dia: 4,
}

export interface AhoraLocal {
  fecha: string
  /** Minutos desde medianoche. */
  min: number
  /** 0 = lunes … 6 = domingo. */
  dow: number
}

export function ahoraEnZona(zona: string, d = new Date()): AhoraLocal {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' })
      .formatToParts(d).map((x) => [x.type, x.value]),
  )
  const dow = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday!)
  return { fecha: `${p.year}-${p.month}-${p.day}`, min: Number(p.hour) * 60 + Number(p.minute), dow }
}

export const aMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h! * 60 + m! }

export function enSilencio(min: number, desde: string, hasta: string): boolean {
  const a = aMin(desde), b = aMin(hasta)
  return a <= b ? min >= a && min < b : min >= a || min < b
}

export interface EstadoDia {
  tipos: Set<string>
  comidas: number
  aguaMl: number
  metaAguaMl: number
}

export interface Pendiente { clave: ClaveRecordatorio; titulo: string; cuerpo: string; url: string }

/** Ventana tras la hora elegida en la que aún se envía (cubre cron cada 15 min con margen). */
export const VENTANA_MIN = 45

const TEXTOS: Record<'desayuno' | 'comida' | 'cena' | 'snack', [string, string]> = {
  desayuno: ['¿Qué has desayunado?', 'Apúntalo en 10 segundos y empieza el día con tu racha.'],
  comida: ['¿Ya has comido?', 'Haz una foto al plato o búscalo y sigue con tus macros al día.'],
  cena: ['Falta la cena', 'Regístrala ahora para cerrar bien el día.'],
  snack: ['¿Algo entre horas?', 'Si has picoteado, apúntalo para que cuadren tus calorías.'],
}

export function recordatoriosPendientes(p: PrefRecordatorios, ahora: AhoraLocal, dia: EstadoDia, enviadosHoy: Set<string>, racha = 0): Pendiente[] {
  if (!p.activo || enSilencio(ahora.min, p.silencio_desde, p.silencio_hasta)) return []
  let cupo = Math.max(0, p.max_dia - [...enviadosHoy].filter((c) => c !== 'resumen').length)
  const out: Pendiente[] = []
  const toca = (hhmm: string | null) => !!hhmm && ahora.min >= aMin(hhmm) && ahora.min < aMin(hhmm) + VENTANA_MIN
  for (const t of ['desayuno', 'comida', 'cena', 'snack'] as const) {
    if (cupo <= 0) break
    if (enviadosHoy.has(t) || dia.tipos.has(t) || !toca(p[t])) continue
    out.push({ clave: t, titulo: TEXTOS[t][0], cuerpo: TEXTOS[t][1], url: "/" }); cupo--
  }
  if (cupo > 0 && !enviadosHoy.has('cierre') && toca(p.cierre) && dia.comidas < 3) {
    out.push({
      clave: 'cierre',
      titulo: 'Cierra tu día',
      cuerpo: dia.comidas === 0
        ? (racha > 0 ? `Tu racha de ${racha} ${racha === 1 ? 'día' : 'días'} está en juego: registra lo que has comido hoy.` : 'Aún no has registrado nada hoy. Un minuto basta.')
        : `Llevas ${dia.comidas} ${dia.comidas === 1 ? 'comida' : 'comidas'} hoy. ¿Falta algo?`,
      url: '/',
    }); cupo--
  }
  if (cupo > 0 && p.agua && !enviadosHoy.has('agua') && ahora.min >= aMin('17:00') && ahora.min < aMin('17:00') + VENTANA_MIN && dia.aguaMl < dia.metaAguaMl / 2) {
    out.push({ clave: 'agua', titulo: 'Un vaso de agua', cuerpo: `Llevas ${dia.aguaMl} ml de ${dia.metaAguaMl}. Hidrátate un poco.`, url: '/agua' })
  }
  return out
}

/** Resumen semanal: lunes entre 9:00 y 9:45 locales. */
export function tocaResumen(p: PrefRecordatorios, ahora: AhoraLocal, enviadosHoy: Set<string>): boolean {
  return !!p.resumen_semanal && ahora.dow === 0 && ahora.min >= 540 && ahora.min < 540 + VENTANA_MIN && !enviadosHoy.has('resumen')
}
