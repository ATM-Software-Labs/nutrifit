/**
 * Bindings, variables y secretos disponibles en las Pages Functions.
 * Secretos (wrangler pages secret put …): AUTH_SECRET, TURNSTILE_SECRET_KEY,
 * BREVO_API_KEY, GEMINI_API_KEY, GROQ_API_KEY, TRUJILLO_API_KEY, TURSO_AUTH_TOKEN.
 * Nunca se versionan. TURSO_DATABASE_URL es una var pública (libsql://…).
 */
export interface Env {
  DB: D1Database
  /** BD aparte con la base de alimentos genéricos (FTS5). Opcional: sin ella se usa solo la lista local. */
  ALIMENTOS?: D1Database
  /** Búsquedas públicas de alimentos. Opcional: sin el binding se usa la caché D1/Turso. */
  KV?: KVNamespace
  AI: Ai

  ENVIRONMENT?: string // 'production' | 'development' | 'preview'
  APP_URL?: string // URL pública base para enlaces de email
  ALLOWED_ORIGINS?: string // lista separada por comas
  TURNSTILE_SITE_KEY?: string
  GEMINI_MODEL?: string
  /** Modelo de visión en ai.trujillomingorance.com. Por defecto llama-3.2-11b-vision-instruct. */
  TRUJILLO_MODEL?: string
  /** URL completa del chat de Trujillo. Si falta, se usa el gateway público. */
  TRUJILLO_AI_URL?: string
  /**
   * Origen del API Gateway de visión. Vacío o localhost: el escáner sigue en Pages.
   * El secreto de cliente no vive aquí. Solo esta URL pública.
   */
  VISION_GATEWAY_URL?: string

  // Secretos
  AUTH_SECRET?: string
  TURNSTILE_SECRET_KEY?: string
  BREVO_API_KEY?: string
  GEMINI_API_KEY?: string
  /** Groq Vision (llama-3.2-11b y, en el mismo plazo, llama-3.2-90b). Sin clave se salta ese paso. */
  GROQ_API_KEY?: string
  /** Opcional: ai.trujillomingorance.com exige Bearer si el gateway no es abierto. */
  TRUJILLO_API_KEY?: string
  /** URL libsql o https de la base externa. Vacía = historial y cachés siguen en D1. */
  TURSO_DATABASE_URL?: string
  /** Token de Turso. Secreto: wrangler pages secret put TURSO_AUTH_TOKEN. */
  TURSO_AUTH_TOKEN?: string
  /** ID público de Google OAuth. Vacío = el inicio con Google no arranca. */
  GOOGLE_CLIENT_ID?: string
  /** Secreto de Google OAuth. wrangler pages secret put GOOGLE_CLIENT_SECRET. */
  GOOGLE_CLIENT_SECRET?: string
}

/** Sesión verificada: cookie __Host-nf_session (web) o token Bearer (app Android). */
export interface Sesion {
  usuarioId: string
  email: string
  exp: number
  via: 'cookie' | 'bearer'
  /** SHA-256 del jti (solo Bearer): permite revocarlo al cerrar sesión. */
  jtiHash?: string
  /** SHA-256 del sid y de la familia (solo cookie): revocación y detección de robo. */
  sidHash?: string
  familiaHash?: string
}

/** Datos compartidos entre el middleware y los handlers (context.data). */
export interface Datos extends Record<string, unknown> {
  ip: string
  sesion: Sesion | null
  /** Set-Cookie de una rotación hecha en esta petición. Vacío si no hubo. */
  cookiesRotacion: string[]
}

/** Firma de handler de NutriFit con Env y datos tipados. */
export type Handler<P extends string = any> = PagesFunction<Env, P, Datos>

export const esProduccion = (env: Env) => (env.ENVIRONMENT ?? 'production') === 'production'
