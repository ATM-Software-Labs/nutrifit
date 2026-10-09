import { test } from 'node:test'
import assert from 'node:assert/strict'
import { falloDeAnalisis, MENSAJE_AUTH, MENSAJE_LIMITE, MENSAJE_PESO, MENSAJE_RED } from '../src/lib/falloAnalisis.ts'

class ApiError extends Error {
  status: number
  codigo?: string
  errorCode?: string
  constructor(status: number, message: string, codigo?: string, errorCode?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.codigo = codigo
    this.errorCode = errorCode
  }
}

class ErrorImagen extends Error {
  codigo: string
  constructor(message: string, codigo: string) {
    super(message)
    this.name = 'ErrorImagen'
    this.codigo = codigo
  }
}

test('cada fallo de la visión tiene su texto y su acción', () => {
  const peso = falloDeAnalisis(new ApiError(413, 'grande', 'x', 'PAYLOAD_TOO_LARGE'))
  assert.equal(peso.mensaje, MENSAJE_PESO)
  assert.equal(peso.elegirOtra, true)
  assert.equal(peso.reintentar, true)

  const limite = falloDeAnalisis(new ApiError(429, 'espera'))
  assert.equal(limite.mensaje, MENSAJE_LIMITE)
  assert.equal(limite.auto, true)
  assert.equal(limite.esperaSeg, 120)

  const auth = falloDeAnalisis(new ApiError(403, 'interno', 'auth_failure', 'AUTH_FAILURE'))
  assert.equal(auth.mensaje, MENSAJE_AUTH)
  assert.equal(auth.reintentar, false)

  const red = falloDeAnalisis(new ApiError(503, 'No hemos podido analizar la foto ahora mismo.', 'ia_no_disponible'))
  assert.equal(red.mensaje, MENSAJE_RED)
  assert.equal(red.auto, true)
  assert.equal(red.reintentar, true)

  const html = falloDeAnalisis(new ApiError(0, 'Sin conexión. Revisa tu red e inténtalo de nuevo.', 'red'))
  assert.equal(html.codigo, 'UPSTREAM_TIMEOUT')

  const local = falloDeAnalisis(new ErrorImagen(MENSAJE_PESO, 'pesada'))
  assert.equal(local.codigo, 'PAYLOAD_TOO_LARGE')
})
