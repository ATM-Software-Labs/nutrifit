/**
 * Bot score de Cloudflare (1 = casi seguro un bot, 99 = casi seguro una persona).
 * Por debajo de 30 Cloudflare lo agrupa como «likely automated».
 * 0 o ausente: no se ha calculado (plan sin Bot Management) y no se bloquea.
 * https://developers.cloudflare.com/bots/concepts/bot-score/
 */
export const UMBRAL_BOT = 30

export function scoreAnomalo(score: number | null | undefined): boolean {
  return typeof score === 'number' && Number.isFinite(score) && score >= 1 && score < UMBRAL_BOT
}

export function puntuacionBot(request: { cf?: unknown }): number | null {
  const cf = request.cf
  if (!cf || typeof cf !== 'object') return null
  const score = (cf as { botManagement?: { score?: unknown } }).botManagement?.score
  return typeof score === 'number' && Number.isFinite(score) ? score : null
}
