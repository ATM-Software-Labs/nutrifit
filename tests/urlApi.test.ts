import assert from 'node:assert/strict'
import { test } from 'node:test'
import { unirApi, urlDeArchivo } from '../src/lib/urlApi.ts'

const GATEWAY = 'https://api.trujillomingorance.com/v1'
const LOCAL = 'http://localhost:5173'

test('la base /v1 quita el prefijo /api y conserva la consulta', () => {
  assert.equal(unirApi(GATEWAY, '/api/comidas/resumen?fecha=2026-10-09'), `${GATEWAY}/comidas/resumen?fecha=2026-10-09`)
  assert.equal(unirApi(`${GATEWAY}/`, '/api/auth/google?formato=json'), `${GATEWAY}/auth/google?formato=json`)
  assert.equal(unirApi(GATEWAY, '/api/archivos/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'), `${GATEWAY}/archivos/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee`)
})

test('una base local conserva /api para el proxy de Vite', () => {
  assert.equal(unirApi(LOCAL, '/api/agua'), `${LOCAL}/api/agua`)
  assert.equal(urlDeArchivo(LOCAL, '/api/archivos/id'), `${LOCAL}/api/archivos/id`)
  assert.equal(urlDeArchivo(GATEWAY, 'https://lh3.googleusercontent.com/a/foto'), 'https://lh3.googleusercontent.com/a/foto')
})
