/**
 * Bindings, variables y secretos disponibles en las Pages Functions.
 * Secretos (wrangler pages secret put …): AUTH_SECRET, TURNSTILE_SECRET_KEY,
 * BREVO_API_KEY, GEMINI_API_KEY. Nunca se versionan.
 */
export interface Env {
  DB: D1Database
  AI: Ai

  ENVIRONMENT?: string // 'production' | 'development' | 'preview'
  APP_URL?: string // URL pública base para enlaces de email
  ALLOWED_ORIGINS?: string // lista separada por comas
  TURNSTILE_SITE_KEY?: string
  GEMINI_MODEL?: string

  // Secretos
  AUTH_SECRET?: string
  TURNSTILE_SECRET_KEY?: string
  BREVO_API_KEY?: string
  GEMINI_API_KEY?: string
}

/** Sesión verificada: cookie nf_session (web) o token Bearer (app Android). */
export interface Sesion {
  usuarioId: string
  email: string
  exp: number
  via: 'cookie' | 'bearer'
  /** SHA-256 del jti (solo Bearer): permite revocarlo al cerrar sesión. */
  jtiHash?: string
}

/** Datos compartidos entre el middleware y los handlers (context.data). */
export interface Datos extends Record<string, unknown> {
  ip: string
  sesion: Sesion | null
}

/** Firma de handler de NutriFit con Env y datos tipados. */
export type Handler<P extends string = any> = PagesFunction<Env, P, Datos>

export const esProduccion = (env: Env) => (env.ENVIRONMENT ?? 'production') === 'production'
