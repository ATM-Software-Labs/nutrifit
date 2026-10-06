// «Descarga la app»: plataforma del dispositivo y resolución del último APK.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detectarPlataforma } from '../src/lib/dispositivo.ts'
import { cabecerasApk, tagDesdeLocation } from '../functions/utils/apk.ts'

test('detectarPlataforma: Android, iPhone, iPad (como Mac táctil) y escritorio', () => {
  assert.equal(detectarPlataforma({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/129 Mobile' }), 'android')
  assert.equal(detectarPlataforma({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1' }), 'ios')
  assert.equal(detectarPlataforma({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605', platform: 'MacIntel', maxTouchPoints: 5 }), 'ios')
  assert.equal(detectarPlataforma({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605', platform: 'MacIntel', maxTouchPoints: 0 }), 'escritorio')
  assert.equal(detectarPlataforma({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/129' }), 'escritorio')
  assert.equal(detectarPlataforma({ userAgent: 'Mozilla/5.0 (Linux; K) Chrome/129', userAgentData: { platform: 'Android', mobile: true } }), 'android')
  assert.equal(detectarPlataforma({}), 'escritorio')
})

test('tagDesdeLocation: solo acepta el APK de nuestro repo en github.com', () => {
  assert.deepEqual(tagDesdeLocation('https://github.com/ATM-Software-Labs/nutrifit/releases/download/v1.0.1/NutriFit.apk'), {
    version: 'v1.0.1',
    url: 'https://github.com/ATM-Software-Labs/nutrifit/releases/download/v1.0.1/NutriFit.apk',
  })
  assert.equal(tagDesdeLocation('/ATM-Software-Labs/nutrifit/releases/download/v2.0.0/NutriFit.apk')?.version, 'v2.0.0')
  assert.equal(tagDesdeLocation(null), null)
  assert.equal(tagDesdeLocation('https://evil.example/ATM-Software-Labs/nutrifit/releases/download/v1/NutriFit.apk'), null)
  assert.equal(tagDesdeLocation('https://github.com/otro/repo/releases/download/v1/NutriFit.apk'), null)
  assert.equal(tagDesdeLocation('https://github.com/ATM-Software-Labs/nutrifit/releases/download/v1/Otro.apk'), null)
})

test('cabecerasApk: descarga directa con tipo Android y tamaño', () => {
  const h = cabecerasApk('v1.0.1', 3795644)
  assert.equal(h.get('content-type'), 'application/vnd.android.package-archive')
  assert.equal(h.get('content-disposition'), 'attachment; filename="NutriFit.apk"')
  assert.equal(h.get('content-length'), '3795644')
  assert.equal(cabecerasApk('v1', null).get('content-length'), null)
})
