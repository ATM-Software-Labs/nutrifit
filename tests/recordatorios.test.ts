import test from 'node:test'
import assert from 'node:assert/strict'
import { ahoraEnZona, enSilencio, PREF_POR_DEFECTO, recordatoriosPendientes, tocaResumen, type PrefRecordatorios } from '../functions/utils/recordatorios.ts'

const p: PrefRecordatorios = { ...PREF_POR_DEFECTO, activo: 1 }
const dia = (tipos: string[] = [], comidas = tipos.length) => ({ tipos: new Set(tipos), comidas, aguaMl: 0, metaAguaMl: 2000 })
const a = (h: number, m = 0, dow = 1) => ({ fecha: '2026-10-13', min: h * 60 + m, dow })

test('zona horaria y cambio de hora (Madrid)', () => {
  assert.deepEqual(ahoraEnZona('Europe/Madrid', new Date('2026-10-12T21:40:00Z')), { fecha: '2026-10-12', min: 23 * 60 + 40, dow: 0 })
  // Tras el 25-oct (UTC+1)
  assert.equal(ahoraEnZona('Europe/Madrid', new Date('2026-10-26T08:00:00Z')).min, 9 * 60)
  assert.equal(ahoraEnZona('America/New_York', new Date('2026-10-12T03:00:00Z')).fecha, '2026-10-11')
})

test('solo avisa si la comida no está registrada', () => {
  assert.deepEqual(recordatoriosPendientes(p, a(14, 35), dia(), new Set()).map((x) => x.clave), ['comida'])
  assert.deepEqual(recordatoriosPendientes(p, a(14, 35), dia(['comida']), new Set()), [])
  assert.deepEqual(recordatoriosPendientes(p, a(14, 35), dia(), new Set(['comida'])), [])
  assert.deepEqual(recordatoriosPendientes(p, a(15, 30), dia(), new Set()), []) // fuera de ventana
  assert.deepEqual(recordatoriosPendientes({ ...p, activo: 0 }, a(14, 35), dia(), new Set()), [])
})

test('cierre del día, silencio y máximo diario', () => {
  const r = recordatoriosPendientes(p, a(22, 30), dia(), new Set(), 5)
  assert.equal(r[0]!.clave, 'cierre')
  assert.match(r[0]!.cuerpo, /racha de 5 días/)
  assert.deepEqual(recordatoriosPendientes(p, a(22, 30), dia(['desayuno', 'comida', 'cena']), new Set()), [])
  assert.ok(enSilencio(23 * 60 + 30, '23:00', '08:00'))
  assert.ok(!enSilencio(12 * 60, '23:00', '08:00'))
  assert.deepEqual(recordatoriosPendientes({ ...p, desayuno: '23:15' }, a(23, 20), dia(), new Set()), [])
  assert.deepEqual(recordatoriosPendientes({ ...p, max_dia: 1 }, a(14, 35), dia(), new Set(['desayuno'])), [])
})

test('resumen semanal solo los lunes a las 9', () => {
  assert.ok(tocaResumen(p, a(9, 10, 0), new Set()))
  assert.ok(!tocaResumen(p, a(9, 10, 1), new Set()))
  assert.ok(!tocaResumen(p, a(9, 10, 0), new Set(['resumen'])))
})

import { avisosExtra, canalesDe, tipoDeClave } from '../functions/utils/recordatorios.ts'

const x = { racha: 4, calorias: 0, proteinas: 0, metaCalorias: 2000, metaProteinas: 120, diasSinRegistro: 0, diasDesdeAlta: 30, enviadosSemana: new Set<string>() }

test('racha en peligro, objetivo, reenganche y bienvenida', () => {
  assert.deepEqual(avisosExtra(p, a(21, 30), dia(), new Set(), x).map((r) => r.clave), ['racha'])
  assert.deepEqual(avisosExtra(p, a(21, 30), dia(['comida']), new Set(), x), [])
  assert.equal(avisosExtra(p, a(22, 30), dia(['comida', 'cena']), new Set(), { ...x, calorias: 2600 })[0]!.titulo, 'Te has pasado de calorías hoy')
  assert.match(avisosExtra(p, a(22, 30), dia(['comida', 'cena']), new Set(), { ...x, calorias: 1800, proteinas: 40 })[0]!.titulo, /proteína/)
  assert.deepEqual(avisosExtra(p, a(19, 5), dia(), new Set(), { ...x, racha: 0, diasSinRegistro: 3 }).map((r) => r.clave), ['inactividad'])
  assert.deepEqual(avisosExtra(p, a(19, 5), dia(), new Set(), { ...x, racha: 0, diasSinRegistro: 5, enviadosSemana: new Set(['inactividad']) }), [])
  assert.deepEqual(avisosExtra(p, a(10, 0), dia(), new Set(), { ...x, diasDesdeAlta: 1 }).map((r) => r.clave), ['bienvenida1'])
})

test('canales por tipo con valores por defecto y personalizados', () => {
  assert.deepEqual(canalesDe(null, 'comidas'), { push: true, email: false, app: false })
  assert.deepEqual(canalesDe({ email: 1, canales_json: '{"comidas":{"email":true}}' }, 'comidas'), { push: true, email: true, app: false })
  assert.equal(tipoDeClave('cena'), 'comidas')
  assert.equal(tipoDeClave('bienvenida3'), 'bienvenida')
})
