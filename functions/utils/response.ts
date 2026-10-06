/** Respuestas JSON y errores HTTP tipados. */

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public extra: Record<string, unknown> = {},
    public headers: HeadersInit = {},
  ) {
    super(message)
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
