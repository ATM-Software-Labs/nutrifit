import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('public/_redirects sirve la SPA con un solo comodín (sin 308 a /)', () => {
  const texto = readFileSync(new URL('../public/_redirects', import.meta.url), 'utf8')
  const reglas = texto
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
  // Una regla explícita «/historial /index.html 200» acaba en 308 → / en Pages.
  assert.deepEqual(reglas.map((l) => l.split(/\s+/)), [['/*', '/index.html', '200']])
})
