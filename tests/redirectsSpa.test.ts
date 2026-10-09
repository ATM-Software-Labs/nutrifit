import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

test('public/_redirects sirve la SPA, incluida /privacidad, sin 404', () => {
  const texto = readFileSync(new URL('../public/_redirects', import.meta.url), 'utf8')
  assert.match(texto, /^\/privacidad\s+\/index\.html\s+200\s*$/m)
  assert.match(texto, /^\s*\/\*\s+\/index\.html\s+200\s*$/m)
  const reglas = texto
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
  assert.equal(reglas.at(-1)?.startsWith('/*'), true)
})
