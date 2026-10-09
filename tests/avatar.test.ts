import assert from 'node:assert/strict'
import { test } from 'node:test'
import { archivoRechazado, avatarGenerado, idArchivoValido } from '../src/lib/avatar.ts'

const ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

test('un archivo sin uuid no se pide', () => {
  assert.equal(idArchivoValido('/api/archivos/id'), false)
  assert.equal(idArchivoValido('/api/archivos/'), false)
  assert.equal(archivoRechazado('/api/archivos/id'), true)
  assert.equal(archivoRechazado(`https://api.trujillomingorance.com/v1/archivos/no-es-uuid`), true)
  assert.equal(archivoRechazado(`https://lh3.googleusercontent.com/a/foto`), false)
})

test('un uuid de archivo sí es mostrable', () => {
  assert.equal(idArchivoValido(`/api/archivos/${ID}`), true)
  assert.equal(idArchivoValido(`https://api.trujillomingorance.com/v1/archivos/${ID}`), true)
  assert.equal(archivoRechazado(`/api/archivos/${ID}`), false)
})

test('el retrato de respaldo usa ui-avatars con el nombre', () => {
  assert.equal(
    avatarGenerado('Ana Fit'),
    'https://ui-avatars.com/api/?name=Ana%20Fit&background=064e3b&color=34d399&bold=true',
  )
  assert.equal(
    avatarGenerado('  '),
    'https://ui-avatars.com/api/?name=NutriFit&background=064e3b&color=34d399&bold=true',
  )
  assert.match(avatarGenerado('@leo'), /name=leo/)
})
