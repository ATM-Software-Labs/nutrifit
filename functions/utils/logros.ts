/**
 * Rachas y logros de NutriFit. Funciones puras (sin D1) para poder probarlas.
 * Fechas siempre como 'YYYY-MM-DD' del día natural del usuario (Europe/Madrid por defecto),
 * así la aritmética no depende de horarios de verano.
 */

export function sumarDiasISO(s: string, n: number): string {
  const [y, m, d] = s.split('-').map(Number)
  const t = new Date(Date.UTC(y!, m! - 1, d! + n))
  return t.toISOString().slice(0, 10)
}

/** Lunes de la semana ISO de una fecha. */
export function lunesDe(s: string): string {
  const [y, m, d] = s.split('-').map(Number)
  const dow = (new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay() + 6) % 7
  return sumarDiasISO(s, -dow)
}

export interface Racha {
  actual: number
  mejor: number
  /** Días sueltos que se han salvado con el comodín (1 por semana). */
  congelados: string[]
  /** true si el comodín de esta semana sigue libre. */
  comodinDisponible: boolean
  hoyRegistrado: boolean
}

/**
 * Racha con comodín: un único día sin registro por semana ISO no rompe la racha,
 * siempre que el día anterior y el siguiente sí tengan registro. Hoy sin registro
 * todavía no rompe nada (el día no ha terminado).
 */
export function calcularRacha(fechas: Iterable<string>, hoy: string): Racha {
  const dias = new Set(fechas)
  const ordenadas = [...dias].filter((f) => f <= hoy).sort()
  const congelados: string[] = []
  const semanasUsadas = new Set<string>()
  let mejor = 0
  let actual = 0
  let prev: string | null = null
  for (const f of ordenadas) {
    if (prev && sumarDiasISO(prev, 1) === f) actual += 1
    else if (prev && sumarDiasISO(prev, 2) === f && !semanasUsadas.has(lunesDe(sumarDiasISO(prev, 1)))) {
      const hueco = sumarDiasISO(prev, 1)
      semanasUsadas.add(lunesDe(hueco))
      congelados.push(hueco)
      actual += 2
    } else actual = 1
    mejor = Math.max(mejor, actual)
    prev = f
  }
  const hoyRegistrado = dias.has(hoy)
  const ayer = sumarDiasISO(hoy, -1)
  // La racha sigue viva si el último registro es hoy o ayer (o anteayer usando el comodín de esta semana).
  let viva = prev === hoy || prev === ayer
  if (!viva && prev === sumarDiasISO(hoy, -2) && !semanasUsadas.has(lunesDe(ayer)) && lunesDe(ayer) === lunesDe(hoy)) {
    viva = true
    semanasUsadas.add(lunesDe(ayer))
    congelados.push(ayer)
    actual += 1
    mejor = Math.max(mejor, actual)
  }
  if (!viva) actual = 0
  return { actual, mejor, congelados, comodinDisponible: !semanasUsadas.has(lunesDe(hoy)), hoyRegistrado }
}

export interface DiaStats {
  fecha: string
  comidas: number
  calorias: number
  proteinas: number
  agua_ml: number
  desayunoTemprano: boolean
}

export interface Estadisticas {
  dias: DiaStats[]
  fotos: number
  comidasTotales: number
  pesajes: number
  /** kg perdidos (+) o ganados (−) desde el primer pesaje. */
  cambioPesoKg: number
  productosCodigoBarras: number
  metaCalorias: number | null
  metaProteinas: number | null
  metaAguaMl: number
  hoy: string
}

export type Nivel = 'bronce' | 'plata' | 'oro' | 'diamante'
export interface DefLogro {
  id: string
  titulo: string
  detalle: string
  icono: 'utensils' | 'camera' | 'flame' | 'beef' | 'droplet' | 'scale' | 'barcode' | 'target' | 'sunrise' | 'calendar' | 'star'
  nivel: Nivel
  meta: number
  progreso: (e: Estadisticas, r: Racha) => number
}

const dentroCalorias = (d: DiaStats, meta: number | null) => !!meta && d.comidas > 0 && Math.abs(d.calorias - meta) <= meta * 0.1
const n = <T,>(xs: T[], f: (x: T) => boolean) => xs.filter(f).length

/** Mejor tramo de días consecutivos que cumplen f. */
function mejorTramo(dias: DiaStats[], f: (d: DiaStats) => boolean): number {
  const ok = new Set(dias.filter(f).map((d) => d.fecha))
  let mejor = 0
  for (const fch of ok) {
    if (ok.has(sumarDiasISO(fch, -1))) continue
    let k = 0
    while (ok.has(sumarDiasISO(fch, k))) k++
    mejor = Math.max(mejor, k)
  }
  return mejor
}

export const LOGROS: DefLogro[] = [
  { id: 'primera_comida', titulo: 'Primer bocado', detalle: 'Registra tu primera comida', icono: 'utensils', nivel: 'bronce', meta: 1, progreso: (e) => e.comidasTotales },
  { id: 'comidas_50', titulo: 'Cuaderno lleno', detalle: 'Registra 50 comidas', icono: 'utensils', nivel: 'plata', meta: 50, progreso: (e) => e.comidasTotales },
  { id: 'comidas_250', titulo: 'Archivo personal', detalle: 'Registra 250 comidas', icono: 'utensils', nivel: 'oro', meta: 250, progreso: (e) => e.comidasTotales },
  { id: 'comidas_1000', titulo: 'Mil platos', detalle: 'Registra 1.000 comidas', icono: 'utensils', nivel: 'diamante', meta: 1000, progreso: (e) => e.comidasTotales },
  { id: 'primera_foto', titulo: 'Ojo de chef', detalle: 'Analiza tu primera foto', icono: 'camera', nivel: 'bronce', meta: 1, progreso: (e) => e.fotos },
  { id: 'fotos_25', titulo: 'Fotógrafo culinario', detalle: 'Analiza 25 fotos', icono: 'camera', nivel: 'plata', meta: 25, progreso: (e) => e.fotos },
  { id: 'racha_3', titulo: 'Buen comienzo', detalle: '3 días seguidos registrando', icono: 'flame', nivel: 'bronce', meta: 3, progreso: (_e, r) => r.mejor },
  { id: 'racha_7', titulo: 'Una semana', detalle: '7 días seguidos registrando', icono: 'flame', nivel: 'bronce', meta: 7, progreso: (_e, r) => r.mejor },
  { id: 'racha_14', titulo: 'Quincena', detalle: '14 días seguidos', icono: 'flame', nivel: 'plata', meta: 14, progreso: (_e, r) => r.mejor },
  { id: 'racha_30', titulo: 'Un mes de hábito', detalle: '30 días seguidos', icono: 'flame', nivel: 'oro', meta: 30, progreso: (_e, r) => r.mejor },
  { id: 'racha_100', titulo: 'Centenario', detalle: '100 días seguidos', icono: 'flame', nivel: 'diamante', meta: 100, progreso: (_e, r) => r.mejor },
  { id: 'dia_completo', titulo: 'Día completo', detalle: 'Registra 3 comidas o más en un día', icono: 'calendar', nivel: 'bronce', meta: 1, progreso: (e) => n(e.dias, (d) => d.comidas >= 3) },
  { id: 'proteina_1', titulo: 'Proteína al día', detalle: 'Alcanza tu objetivo de proteína', icono: 'beef', nivel: 'bronce', meta: 1, progreso: (e) => n(e.dias, (d) => !!e.metaProteinas && d.proteinas >= e.metaProteinas) },
  { id: 'proteina_10', titulo: 'Constructor', detalle: 'Objetivo de proteína 10 días', icono: 'beef', nivel: 'plata', meta: 10, progreso: (e) => n(e.dias, (d) => !!e.metaProteinas && d.proteinas >= e.metaProteinas) },
  { id: 'proteina_50', titulo: 'Músculo de acero', detalle: 'Objetivo de proteína 50 días', icono: 'beef', nivel: 'oro', meta: 50, progreso: (e) => n(e.dias, (d) => !!e.metaProteinas && d.proteinas >= e.metaProteinas) },
  { id: 'agua_1', titulo: 'Hidratado', detalle: 'Cumple tu objetivo de agua', icono: 'droplet', nivel: 'bronce', meta: 1, progreso: (e) => n(e.dias, (d) => d.agua_ml >= e.metaAguaMl) },
  { id: 'agua_7', titulo: 'Fuente de vida', detalle: 'Objetivo de agua 7 días', icono: 'droplet', nivel: 'plata', meta: 7, progreso: (e) => n(e.dias, (d) => d.agua_ml >= e.metaAguaMl) },
  { id: 'agua_30', titulo: 'Océano', detalle: 'Objetivo de agua 30 días', icono: 'droplet', nivel: 'oro', meta: 30, progreso: (e) => n(e.dias, (d) => d.agua_ml >= e.metaAguaMl) },
  { id: 'en_objetivo_1', titulo: 'Diana', detalle: 'Un día dentro de tus calorías (±10 %)', icono: 'target', nivel: 'bronce', meta: 1, progreso: (e) => n(e.dias, (d) => dentroCalorias(d, e.metaCalorias)) },
  { id: 'en_objetivo_7', titulo: 'Semana en el blanco', detalle: '7 días seguidos dentro de tus calorías', icono: 'target', nivel: 'oro', meta: 7, progreso: (e) => mejorTramo(e.dias, (d) => dentroCalorias(d, e.metaCalorias)) },
  { id: 'madrugador', titulo: 'Madrugador', detalle: 'Desayuno registrado antes de las 9:00', icono: 'sunrise', nivel: 'bronce', meta: 1, progreso: (e) => n(e.dias, (d) => d.desayunoTemprano) },
  { id: 'madrugador_10', titulo: 'Alondra', detalle: '10 desayunos antes de las 9:00', icono: 'sunrise', nivel: 'plata', meta: 10, progreso: (e) => n(e.dias, (d) => d.desayunoTemprano) },
  { id: 'primer_pesaje', titulo: 'En la báscula', detalle: 'Registra tu peso por primera vez', icono: 'scale', nivel: 'bronce', meta: 1, progreso: (e) => e.pesajes },
  { id: 'pesajes_12', titulo: 'Seguimiento fiel', detalle: 'Registra tu peso 12 veces', icono: 'scale', nivel: 'plata', meta: 12, progreso: (e) => e.pesajes },
  { id: 'peso_2kg', titulo: 'Primeros 2 kg', detalle: 'Cambia 2 kg hacia tu objetivo', icono: 'scale', nivel: 'plata', meta: 2, progreso: (e) => Math.abs(e.cambioPesoKg) },
  { id: 'peso_5kg', titulo: 'Cinco kilos', detalle: 'Cambia 5 kg hacia tu objetivo', icono: 'scale', nivel: 'oro', meta: 5, progreso: (e) => Math.abs(e.cambioPesoKg) },
  { id: 'codigo_barras', titulo: 'Escáner', detalle: 'Usa el código de barras de un producto', icono: 'barcode', nivel: 'bronce', meta: 1, progreso: (e) => e.productosCodigoBarras },
  { id: 'coleccionista', titulo: 'Coleccionista', detalle: 'Desbloquea 15 logros', icono: 'star', nivel: 'diamante', meta: 15, progreso: () => 0 },
]

export interface EstadoLogro {
  id: string
  titulo: string
  detalle: string
  icono: DefLogro['icono']
  nivel: Nivel
  meta: number
  progreso: number
  desbloqueado: boolean
}

export function evaluarLogros(e: Estadisticas, r: Racha): EstadoLogro[] {
  const base = LOGROS.map((l) => {
    const p = Math.max(0, Math.round(l.progreso(e, r) * 10) / 10)
    return { id: l.id, titulo: l.titulo, detalle: l.detalle, icono: l.icono, nivel: l.nivel, meta: l.meta, progreso: Math.min(p, l.meta), desbloqueado: p >= l.meta }
  })
  const col = base.find((b) => b.id === 'coleccionista')!
  const otros = base.filter((b) => b.desbloqueado && b.id !== 'coleccionista').length
  col.progreso = Math.min(otros, col.meta)
  col.desbloqueado = otros >= col.meta
  return base
}

export interface ResumenSemanal {
  desde: string
  hasta: string
  diasRegistrados: number
  adherenciaPct: number
  diasEnObjetivo: number
  mediaCalorias: number
}

/** Resumen de la semana ISO anterior a `hoy` si es lunes-martes, o la actual en curso. */
export function resumenSemanal(e: Estadisticas): ResumenSemanal {
  const desde = lunesDe(e.hoy)
  const hasta = sumarDiasISO(desde, 6)
  const dias = e.dias.filter((d) => d.fecha >= desde && d.fecha <= hasta && d.comidas > 0)
  let transcurridos = 1
  while (transcurridos < 7 && sumarDiasISO(desde, transcurridos) <= e.hoy) transcurridos++
  return {
    desde,
    hasta,
    diasRegistrados: dias.length,
    adherenciaPct: Math.round((dias.length / transcurridos) * 100),
    diasEnObjetivo: dias.filter((d) => dentroCalorias(d, e.metaCalorias)).length,
    mediaCalorias: dias.length ? Math.round(dias.reduce((s, d) => s + d.calorias, 0) / dias.length) : 0,
  }
}
