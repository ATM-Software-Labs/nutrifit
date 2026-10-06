/** Utilidades compartidas por las Pages Functions. */
export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers)
  headers.set('content-type', 'application/json; charset=utf-8')
  headers.set('cache-control', 'no-store')
  return new Response(JSON.stringify(data), { ...init, headers })
}

export function error(status: number, message: string): Response {
  return json({ ok: false, error: message }, { status })
}
