// Bloque «Descarga la app»: plataforma del dispositivo y resumen de la release.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detectarPlataforma } from '../src/lib/dispositivo.ts'
import { resumirRelease } from '../functions/api/app/version.ts'

test('detectarPlataforma: Android, iPhone, iPad (como Mac táctil) y escritorio', () => {
  assert.equal(detectarPlataforma({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/129 Mobile' }), 'android')
  assert.equal(detectarPlataforma({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1' }), 'ios')
  assert.equal(detectarPlataforma({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605', platform: 'MacIntel', maxTouchPoints: 5 }), 'ios')
  assert.equal(detectarPlataforma({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605', platform: 'MacIntel', maxTouchPoints: 0 }), 'escritorio')
  assert.equal(detectarPlataforma({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/129' }), 'escritorio')
  // userAgentData manda sobre un UA reducido
  assert.equal(detectarPlataforma({ userAgent: 'Mozilla/5.0 (Linux; K) Chrome/129', userAgentData: { platform: 'Android', mobile: true } }), 'android')
  assert.equal(detectarPlataforma({}), 'escritorio')
})

test('resumirRelease: versión, tamaño del NutriFit.apk y fecha; datos raros → null', () => {
  assert.deepEqual(
    resumirRelease({ tag_name: 'v1.0.0', published_at: '2026-10-06T18:24:18Z', assets: [{ name: 'NutriFit-v1.0.0.apk', size: 1 }, { name: 'NutriFit.apk', size: 3795644 }] }),
    { version: 'v1.0.0', tamano: 3795644, fecha: '2026-10-06' },
  )
  assert.deepEqual(resumirRelease(null), { version: null, tamano: null, fecha: null })
  assert.equal(resumirRelease({ tag_name: '<script>' }).version, null)
})
