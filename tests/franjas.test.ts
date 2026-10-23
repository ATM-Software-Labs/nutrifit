import test from 'node:test'
import assert from 'node:assert/strict'
import { ahoraEnZona } from '../functions/utils/recordatorios.ts'
import {
  FRANJAS_POR_DEFECTO, franjaCubierta, franjasEfectivas, franjasPendientes, limiteAviso, minutoAviso, minutoDeRegistro, minutoLocalDe, sugerirFranjas, textoFranja,
  type Franja, type RegistroHoy,
} from '../functions/utils/franjas.ts'
import { avisoFranja, leerTokenAccion, tokenAccion } from '../functions/utils/accionAviso.ts'
import { horasLegado } from '../functions/api/recordatorios/index.ts'

const pref = { activo: 1, silencio_desde: '23:00', silencio_hasta: '08:00' }
const todas = FRANJAS_POR_DEFECTO.map((f) => ({ ...f, activo: true }))
const def = franjasEfectivas([])
const at = (h: number, m = 0, dow = 1) => ({ fecha: '2026-10-13', min: h * 60 + m, dow })
const claves = (fs: Franja[], ahora: ReturnType<typeof at>, regs: RegistroHoy[] = [], env = new Set<string>()) => franjasPendientes(pref, fs, ahora, regs, env).map((x) => x.clave)

test('por defecto: desayuno, comida y cena activas; media mañana y merienda no', () => {
  assert.deepEqual(def.filter((f) => f.activo).map((f) => f.id), ['desayuno', 'comida', 'cena'])
  // Con preferencias antiguas: merienda activa si había hora de snack, comidas apagadas si no tenían hora.
  const leg = franjasEfectivas([], { desayuno: null, comida: '14:30', cena: '21:30', snack: '18:00' })
  assert.deepEqual(leg.filter((f) => f.activo).map((f) => f.id), ['comida', 'merienda', 'cena'])
})

test('avisa al final de la franja o X min tras el inicio', () => {
  const comida = def.find((f) => f.id === 'comida')!
  assert.equal(minutoAviso(comida), 15 * 60 + 30)
  assert.equal(minutoAviso({ ...comida, aviso_min: 30 }), 14 * 60 + 30)
  assert.equal(minutoAviso({ ...comida, aviso_min: 600 }), 15 * 60 + 30) // nunca después del fin
  assert.deepEqual(claves(def, at(15, 29)), [])
  assert.deepEqual(claves(def, at(15, 30)), ['f:comida'])
  assert.deepEqual(claves([{ ...comida, aviso_min: 30 }], at(14, 31)), ['f:comida'])
})

test('tolerante a un cron tardío: vale hasta fin+90 min sin pisar la siguiente franja', () => {
  const comida = def.find((f) => f.id === 'comida')!
  assert.equal(limiteAviso(comida, def.filter((f) => f.activo)), 17 * 60)
  assert.deepEqual(claves(def, at(16, 55)), ['f:comida']) // ronda con 85 min de retraso
  assert.deepEqual(claves(def, at(17, 0)), [])
  // Con merienda activa (empieza 17:30) el límite sigue siendo 17:00; con una que empiece 16:00, se corta ahí.
  const conMerienda = todas.map((f) => (f.id === 'merienda' ? { ...f, inicio: '16:00', fin: '17:00' } : f))
  assert.equal(limiteAviso(comida, conMerienda), 16 * 60)
  // Margen mínimo garantizado aunque la siguiente empiece justo al acabar.
  const pegada = todas.map((f) => (f.id === 'merienda' ? { ...f, inicio: '15:30', fin: '16:30' } : f))
  assert.equal(limiteAviso(comida, pegada), 15 * 60 + 50)
  // La cena (fin 22:30) no se pasa de medianoche.
  assert.equal(limiteAviso(def.find((f) => f.id === 'cena')!, def), 24 * 60)
})

test('no avisa si la comida ya está apuntada, avisada, hecha o saltada', () => {
  assert.deepEqual(claves(def, at(15, 40), [{ tipo: 'comida', min: 14 * 60 }]), [])
  assert.deepEqual(claves(def, at(15, 40), [{ tipo: 'comida', min: 12 * 60 + 40 }]), []) // antes de la franja: también cuenta
  assert.deepEqual(claves(def, at(15, 40), [{ tipo: 'comida', min: null }]), [])
  assert.deepEqual(claves(def, at(15, 40), [{ tipo: 'desayuno', min: 9 * 60 }]), ['f:comida'])
  for (const k of ['f:comida', 'h:comida', 's:comida']) assert.deepEqual(claves(def, at(15, 40), [], new Set([k])), [], k)
})

test('varias franjas del mismo tipo (snack): cada apunte cuenta para la más cercana', () => {
  const mm = todas.find((f) => f.id === 'media_manana')!
  const me = todas.find((f) => f.id === 'merienda')!
  const snack11 = [{ tipo: 'snack', min: 11 * 60 + 30 }]
  assert.ok(franjaCubierta(mm, todas, snack11))
  assert.ok(!franjaCubierta(me, todas, snack11))
  assert.ok(franjaCubierta(me, todas, [{ tipo: 'snack', min: 16 * 60 }])) // corte en 15:00 (mitad entre 12:30 y 17:30)
  assert.ok(!franjaCubierta(mm, todas, [{ tipo: 'snack', min: 16 * 60 }]))
  // Si solo hay una franja snack activa, cualquier snack del día la cubre.
  assert.ok(franjaCubierta(me, def.map((f) => (f.id === 'merienda' ? { ...f, activo: true } : f)), snack11))
})

test('días de la semana, silencio y desactivado', () => {
  const laborables = def.map((f) => ({ ...f, dias: 31 }))
  assert.deepEqual(claves(laborables, at(15, 40, 4)), ['f:comida']) // viernes
  assert.deepEqual(claves(laborables, at(15, 40, 5)), []) // sábado
  const tarde = [{ ...def.find((f) => f.id === 'cena')!, inicio: '22:00', fin: '23:10' }]
  assert.deepEqual(claves(tarde, at(23, 15)), []) // en silencio
  assert.deepEqual(franjasPendientes({ ...pref, activo: 0 }, def, at(15, 40), [], new Set()), [])
  assert.deepEqual(claves(def.map((f) => ({ ...f, activo: false })), at(15, 40)), [])
})

test('ordenadas por hora de aviso (el máximo diario se aplica en ese orden)', () => {
  const r = claves(todas, at(12, 40))
  assert.deepEqual(r, ['f:desayuno', 'f:media_manana'].filter((k) => k !== 'f:desayuno')) // el desayuno ya caducó (10:00 + 90 → 11:00)
  const solapadas = [{ ...todas[2]!, id: 'p_a', inicio: '13:00', fin: '14:00' }, { ...todas[2]!, id: 'p_b', tipo: 'cena' as const, inicio: '12:00', fin: '13:30' }]
  assert.deepEqual(claves(solapadas, at(14, 1)), ['f:p_b', 'f:p_a'])
})

test('cambio de hora (Europe/Madrid): mismas horas locales antes y después', () => {
  // 25-oct-2026: 03:00 CEST → 02:00 CET. 15:30 local = 13:30Z el 24 y 14:30Z el 26.
  for (const iso of ['2026-10-24T13:30:00Z', '2026-10-25T14:30:00Z', '2026-10-26T14:30:00Z']) {
    const ahora = ahoraEnZona('Europe/Madrid', new Date(iso))
    assert.equal(ahora.min, 15 * 60 + 30, iso)
    assert.deepEqual(franjasPendientes(pref, def, ahora, [], new Set()).map((x) => x.clave), ['f:comida'], iso)
  }
  // 29-mar-2026: 02:00 CET → 03:00 CEST. Desayuno (fin 10:00) = 09:00Z antes y 08:00Z ese día.
  assert.equal(ahoraEnZona('Europe/Madrid', new Date('2026-03-28T09:00:00Z')).min, 10 * 60)
  assert.equal(ahoraEnZona('Europe/Madrid', new Date('2026-03-29T08:00:00Z')).min, 10 * 60)
  // creado_en (UTC) → minuto local, en ambos lados del cambio.
  assert.deepEqual(minutoLocalDe('2026-10-24 12:15:00', 'Europe/Madrid'), { fecha: '2026-10-24', min: 14 * 60 + 15 })
  assert.deepEqual(minutoLocalDe('2026-10-26 13:15:00', 'Europe/Madrid'), { fecha: '2026-10-26', min: 14 * 60 + 15 })
  assert.deepEqual(minutoLocalDe('2026-10-25 23:30:00', 'Europe/Madrid'), { fecha: '2026-10-26', min: 30 })
})

test('minuto de un apunte: su hora, o cuándo se creó si fue el mismo día', () => {
  assert.equal(minutoDeRegistro({ fecha: '2026-10-13', hora: '14:20', creado_en: '2026-10-13 21:00:00' }, 'Europe/Madrid'), 14 * 60 + 20)
  assert.equal(minutoDeRegistro({ fecha: '2026-10-13', hora: null, creado_en: '2026-10-13 12:20:00' }, 'Europe/Madrid'), 14 * 60 + 20)
  assert.equal(minutoDeRegistro({ fecha: '2026-10-12', hora: null, creado_en: '2026-10-13 07:00:00' }, 'Europe/Madrid'), null) // apuntado otro día
})

test('sugerencias a partir del historial', () => {
  const regs = ['14:05', '14:20', '14:35', '14:50', '15:00', '13:40'].map((h, i) => ({ fecha: `2026-10-0${i + 1}`, tipo: 'comida', min: Number(h.slice(0, 2)) * 60 + Number(h.slice(3)) }))
  // Apuntes a las 23:30 (todo de golpe por la noche) no cuentan para la comida.
  regs.push({ fecha: '2026-10-07', tipo: 'comida', min: 23 * 60 + 30 })
  const s = sugerirFranjas(regs)
  assert.deepEqual({ inicio: s.comida!.inicio, fin: s.comida!.fin, dias: s.comida!.dias }, { inicio: '14:05', fin: '14:50', dias: 6 })
  assert.equal(s.comida!.texto, 'Sueles comer entre 14:05 y 14:50')
  assert.equal(s.cena, undefined)
  // Pocos días → sin sugerencia; franja mínima de 30 min.
  assert.deepEqual(sugerirFranjas(regs.slice(0, 3)), {})
  const fijos = [1, 2, 3, 4].map((d) => ({ fecha: `2026-10-0${d}`, tipo: 'cena', min: 21 * 60 }))
  assert.deepEqual([sugerirFranjas(fijos).cena!.inicio, sugerirFranjas(fijos).cena!.fin], ['20:45', '21:15'])
})

test('carga del aviso apta para reloj y token de los botones', async () => {
  const comida = def.find((f) => f.id === 'comida')!
  const t = textoFranja(comida)
  assert.equal(t.titulo, '🍽️ ¿Ya has comido?')
  assert.ok(t.cuerpo.length <= 60)
  assert.equal(textoFranja({ ...comida, id: 'p_x', nombre: 'Recena' }).titulo, '🍽️ ¿Recena?')
  const tok = await tokenAccion('s'.repeat(40), 'u1', 'comida', '2026-10-13', Date.parse('2026-10-13T13:30:00Z'))
  const a = avisoFranja({ ...t, url: '/?apuntar=comida', franja: 'comida', fecha: '2026-10-13', token: tok })
  assert.equal(a.etiqueta, 'comida-comida')
  assert.equal(a.renotificar, true)
  assert.deepEqual(a.acciones!.map((x) => x.accion), ['hecho', 'saltar', 'apuntar'])
  assert.ok(JSON.stringify(a).length < 1500)
  assert.deepEqual(await leerTokenAccion('s'.repeat(40), tok, Date.parse('2026-10-14T12:00:00Z')), { u: 'u1', f: 'comida', d: '2026-10-13', exp: Math.floor(Date.parse('2026-10-13T13:30:00Z') / 1000) + 36 * 3600 })
  assert.equal(await leerTokenAccion('s'.repeat(40), tok, Date.parse('2026-10-15T12:00:00Z')), null) // caducado
  assert.equal(await leerTokenAccion('x'.repeat(40), tok, Date.parse('2026-10-13T14:00:00Z')), null) // otra clave
})

test('horas para la app nativa salen de las franjas', () => {
  assert.deepEqual(horasLegado(def), { desayuno: '10:00', comida: '15:30', cena: '22:30', snack: null })
  assert.deepEqual(horasLegado(todas.map((f) => (f.id === 'comida' ? { ...f, aviso_min: 30 } : f))), { desayuno: '10:00', comida: '14:30', cena: '22:30', snack: '12:30' })
})

test('alarma del reloj: siguiente múltiplo de 5 min + 20 s', async () => {
  const { siguienteAlarma } = await import('../workers/cron/reloj-calc.ts')
  const t = Date.parse('2026-10-23T12:03:10Z')
  assert.equal(new Date(siguienteAlarma(t)).toISOString(), '2026-10-23T12:05:20.000Z')
  assert.equal(new Date(siguienteAlarma(Date.parse('2026-10-23T12:05:20Z'))).toISOString(), '2026-10-23T12:10:20.000Z')
  assert.equal(new Date(siguienteAlarma(Date.parse('2026-10-23T12:05:19Z'))).toISOString(), '2026-10-23T12:05:20.000Z')
})
