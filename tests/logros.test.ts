import test from 'node:test'
import assert from 'node:assert/strict'
import { calcularRacha, evaluarLogros, lunesDe, resumenSemanal, sumarDiasISO, type Estadisticas } from '../functions/utils/logros.ts'

test('sumarDiasISO cruza meses, años y el cambio de hora (DST)', () => {
  assert.equal(sumarDiasISO('2026-10-24', 2), '2026-10-26') // fin de horario de verano en Madrid
  assert.equal(sumarDiasISO('2026-03-28', 1), '2026-03-29')
  assert.equal(sumarDiasISO('2026-12-31', 1), '2027-01-01')
  assert.equal(lunesDe('2026-10-12'), '2026-10-12')
  assert.equal(lunesDe('2026-10-18'), '2026-10-12')
})

test('racha básica y hoy sin registrar no la rompe', () => {
  const r = calcularRacha(['2026-10-09', '2026-10-10', '2026-10-11'], '2026-10-12')
  assert.equal(r.actual, 3)
  assert.equal(r.hoyRegistrado, false)
  assert.equal(calcularRacha(['2026-10-12'], '2026-10-12').actual, 1)
})

test('el comodín salva un día por semana', () => {
  const r = calcularRacha(['2026-10-05', '2026-10-06', '2026-10-08', '2026-10-09'], '2026-10-09')
  assert.equal(r.actual, 5)
  assert.deepEqual(r.congelados, ['2026-10-07'])
  assert.equal(r.comodinDisponible, false)
  // segundo hueco en la misma semana rompe
  const r2 = calcularRacha(['2026-10-05', '2026-10-07', '2026-10-09'], '2026-10-09')
  assert.equal(r2.actual, 1)
  assert.equal(r2.mejor, 3)
})

test('dos días sin registrar rompen la racha', () => {
  assert.equal(calcularRacha(['2026-10-01', '2026-10-02'], '2026-10-12').actual, 0)
  assert.equal(calcularRacha(['2026-10-01', '2026-10-02'], '2026-10-12').mejor, 2)
})

test('racha a través del cambio de hora', () => {
  const fechas = ['2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27']
  assert.equal(calcularRacha(fechas, '2026-10-27').actual, 5)
})

const base: Estadisticas = { dias: [], emojisDistintos: 0, comidasTotales: 0, pesajes: 0, cambioPesoKg: 0, productosCodigoBarras: 0, metaCalorias: 2000, metaProteinas: 120, metaAguaMl: 2000, hoy: '2026-10-12' }

test('logros: primeras veces, progreso acotado y coleccionista', () => {
  const e = { ...base, comidasTotales: 1, emojisDistintos: 5, dias: [{ fecha: '2026-10-12', comidas: 1, calorias: 1950, proteinas: 130, agua_ml: 2100, desayunoTemprano: true }] }
  const l = evaluarLogros(e, calcularRacha(['2026-10-12'], '2026-10-12'))
  const por = Object.fromEntries(l.map((x) => [x.id, x]))
  for (const id of ['primera_comida', 'primera_foto', 'proteina_1', 'agua_1', 'en_objetivo_1', 'madrugador']) assert.ok(por[id]!.desbloqueado, id)
  assert.equal(por.racha_7!.desbloqueado, false)
  assert.equal(por.racha_7!.progreso, 1)
  assert.equal(por.comidas_50!.progreso, 1)
  assert.equal(por.coleccionista!.progreso, 6)
  assert.ok(l.length >= 25)
  assert.equal(new Set(l.map((x) => x.id)).size, l.length)
})

test('7 días seguidos en objetivo', () => {
  const dias = Array.from({ length: 7 }, (_, i) => ({ fecha: sumarDiasISO('2026-10-01', i), comidas: 3, calorias: 2050, proteinas: 0, agua_ml: 0, desayunoTemprano: false }))
  const l = evaluarLogros({ ...base, dias }, calcularRacha([], base.hoy))
  assert.ok(l.find((x) => x.id === 'en_objetivo_7')!.desbloqueado)
})

test('resumen semanal', () => {
  const dias = [{ fecha: '2026-10-12', comidas: 2, calorias: 2000, proteinas: 0, agua_ml: 0, desayunoTemprano: false }]
  const r = resumenSemanal({ ...base, dias, hoy: '2026-10-13' })
  assert.equal(r.desde, '2026-10-12')
  assert.equal(r.diasRegistrados, 1)
  assert.equal(r.adherenciaPct, 50)
  assert.equal(r.diasEnObjetivo, 1)
})
