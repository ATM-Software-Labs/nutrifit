/** Respuestas JSON y errores HTTP tipados. */

export class HttpError extends Error {
  status: number
  extra: Record<string, unknown>
  headers: HeadersInit
  // Sin "parameter properties": así el archivo también corre con el
  // type-stripping nativo de Node en los tests.
  constructor(status: number, message: string, extra: Record<string, unknown> = {}, headers: HeadersInit = {}) {
    super(message)
    this.status = status
    this.extra = extra
    this.headers = headers
  }
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers)
  headers.set('content-type', 'application/json; charset=utf-8')
  if (!headers.has('cache-control')) headers.set('cache-control', 'no-store')
  return new Response(JSON.stringify(data), { ...init, headers })
}

export function error(status: number, message: string, extra: Record<string, unknown> = {}, headers?: HeadersInit) {
  return json({ ok: false, error: message, ...extra }, { status, headers })
}

export const noAutenticado = () => new HttpError(401, 'Necesitas iniciar sesión.')
