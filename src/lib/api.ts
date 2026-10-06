/** Cliente mínimo para las Pages Functions (/api/*). */
export interface HealthResponse {
  ok: boolean
  service: string
  time: string
}

export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const res = await fetch('/api/health', { signal })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return (await res.json()) as HealthResponse
}
