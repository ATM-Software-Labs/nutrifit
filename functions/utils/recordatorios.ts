/**
 * Lógica pura de recordatorios (la usa el Worker nutrifit-cron y los tests).
 * Un recordatorio de comida solo sale si esa comida no está registrada todavía,
 * fuera de las horas de silencio, como mucho `max_dia` al día y una vez por clave y día.
 */
export type ClaveRecordatorio = 'desayuno' | 'comida' | 'cena' | 'snack' | 'cierre' | 'agua' | 'resumen' | 'racha' | 'objetivo' | 'inactividad' | 'bienvenida1' | 'bienvenida3'

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
  canales_json?: string | null
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

/** Tipos de aviso que el usuario puede configurar por canal. */
export const TIPOS_AVISO = ['comidas', 'agua', 'cierre', 'racha', 'objetivo', 'logros', 'resumen', 'inactividad', 'bienvenida', 'seguridad'] as const
export type TipoAviso = (typeof TIPOS_AVISO)[number]
export interface Canales { push: boolean; email: boolean; app: boolean }

export const CANALES_POR_DEFECTO: Record<TipoAviso, Canales> = {
  comidas: { push: true, email: false, app: false },
  agua: { push: true, email: false, app: false },
  cierre: { push: true, email: false, app: true },
  racha: { push: true, email: false, app: true },
  objetivo: { push: true, email: false, app: true },
  logros: { push: true, email: false, app: true },
  resumen: { push: true, email: true, app: true },
  inactividad: { push: true, email: true, app: true },
  bienvenida: { push: false, email: true, app: true },
  seguridad: { push: false, email: true, app: true },
}

export function tipoDeClave(c: ClaveRecordatorio | 'logro'): TipoAviso {
  if (c === 'desayuno' || c === 'comida' || c === 'cena' || c === 'snack') return 'comidas'
  if (c === 'bienvenida1' || c === 'bienvenida3') return 'bienvenida'
  if (c === 'logro') return 'logros'
  return c as TipoAviso
}

export function canalesDe(p: Pick<PrefRecordatorios, 'canales_json' | 'email'> | null, tipo: TipoAviso): Canales {
  let custom: Partial<Record<TipoAviso, Partial<Canales>>> = {}
  try { custom = p?.canales_json ? JSON.parse(p.canales_json) : {} } catch { custom = {} }
  const base = CANALES_POR_DEFECTO[tipo]
  const c = { ...base, ...(custom[tipo] ?? {}) }
  return { push: !!c.push, email: !!c.email, app: !!c.app }
}

export interface ContextoExtra {
  racha: number
  calorias: number
  proteinas: number
  metaCalorias: number | null
  metaProteinas: number | null
  /** Días desde el último registro (null si nunca registró). */
  diasSinRegistro: number | null
  /** Días desde el alta. */
  diasDesdeAlta: number
  /** Claves enviadas en los últimos 7 días (para inactividad). */
  enviadosSemana: Set<string>
}

/** Avisos de la tarde/noche y de ciclo de vida, además de los de comidas. */
export function avisosExtra(p: PrefRecordatorios, ahora: AhoraLocal, dia: EstadoDia, enviadosHoy: Set<string>, x: ContextoExtra): Pendiente[] {
  if (enSilencio(ahora.min, p.silencio_desde, p.silencio_hasta)) return []
  const out: Pendiente[] = []
  const cierre = p.cierre ? aMin(p.cierre) : aMin('22:30')
  const en = (m: number) => ahora.min >= m && ahora.min < m + VENTANA_MIN
  // Racha en peligro: 1 h antes del cierre, si hay racha y hoy no hay nada.
  if (p.activo && x.racha >= 2 && dia.comidas === 0 && !enviadosHoy.has('racha') && en(cierre - 60)) {
    out.push({ clave: 'racha', titulo: `Tu racha de ${x.racha} días está en peligro`, cuerpo: 'Registra una comida antes de medianoche para no perderla.', url: '/' })
  }
  // Objetivo del día muy desviado (al cierre, con al menos 2 comidas).
  if (p.activo && dia.comidas >= 2 && !enviadosHoy.has('objetivo') && en(cierre)) {
    if (x.metaCalorias && x.calorias > x.metaCalorias * 1.15) {
      out.push({ clave: 'objetivo', titulo: 'Te has pasado de calorías hoy', cuerpo: `Llevas ${Math.round(x.calorias)} de ${x.metaCalorias} kcal. Mañana es otro día: compénsalo con algo ligero.`, url: '/historial' })
    } else if (x.metaProteinas && x.proteinas < x.metaProteinas * 0.6) {
      out.push({ clave: 'objetivo', titulo: 'Te falta proteína hoy', cuerpo: `Llevas ${Math.round(x.proteinas)} de ${x.metaProteinas} g. Un yogur, huevos o atún te acercan.`, url: '/' })
    }
  }
  // Reenganche: 3+ días sin registrar, como mucho una vez por semana, a las 19:00.
  if (x.diasSinRegistro !== null && x.diasSinRegistro >= 3 && !x.enviadosSemana.has('inactividad') && en(aMin('19:00'))) {
    out.push({ clave: 'inactividad', titulo: 'Te echamos de menos', cuerpo: `Hace ${x.diasSinRegistro} días que no registras nada. Vuelve con una foto: tardas 10 segundos.`, url: '/' })
  }
  // Bienvenida día 1 y día 3 (a las 10:00).
  if (x.diasDesdeAlta === 1 && !x.enviadosSemana.has('bienvenida1') && en(aMin('10:00'))) {
    out.push({ clave: 'bienvenida1', titulo: 'Truco del día: la foto del plato', cuerpo: 'Haz una foto a tu comida y NutriFit calcula calorías y macros. También puedes escanear el código de barras.', url: '/' })
  }
  if (x.diasDesdeAlta === 3 && !x.enviadosSemana.has('bienvenida3') && en(aMin('10:00'))) {
    out.push({ clave: 'bienvenida3', titulo: 'Rachas, logros y recordatorios', cuerpo: 'Registra cada día para subir tu racha y desbloquear logros. Activa los recordatorios en Ajustes para no olvidarte.', url: '/logros' })
  }
  return out
}
