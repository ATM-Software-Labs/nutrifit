import type { Env } from './env.ts'
export const ORIGEN_PUBLICO = 'https://nutri.trujillomingorance.com'
/** Origen https absoluto para enlaces y og:image (los rastreadores no aceptan rutas relativas). */
export function origenPublico(env: Pick<Env, 'APP_URL'>): string {
  const u = env.APP_URL?.trim().replace(/\/+$/, '')
  return u && /^https:\/\//.test(u) ? u : ORIGEN_PUBLICO
}
