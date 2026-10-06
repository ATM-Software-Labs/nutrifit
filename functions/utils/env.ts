/**
 * Bindings, variables y secretos disponibles en las Pages Functions.
 * Secretos (wrangler pages secret put …): AUTH_SECRET, TURNSTILE_SECRET_KEY,
 * BREVO_API_KEY, GEMINI_API_KEY, GROQ_API_KEY, TRUJILLO_AI_TOKEN, IA_DIAG_TOKEN.
 * Nunca se versionan.
 */
export interface Env {
  DB: D1Database
  AI: Ai

  ENVIRONMENT?: string // 'production' | 'development' | 'preview'
  APP_URL?: string // URL pública base para enlaces de email
  ALLOWED_ORIGINS?: string // lista separada por comas
  TURNSTILE_SITE_KEY?: string
  GEMINI_MODEL?: string

  // --- IA (ver functions/utils/ia.ts y docs/BACKEND.md §5) ---
  /** Orden de la cadena, p. ej. "gemini,groq,trujillo,workersai". */
  IA_PROVEEDORES?: string
  IA_TIMEOUT_MS?: string // por llamada (13000)
  IA_PRESUPUESTO_MS?: string // total por petición (45000)
  IA_CIRCUITO_FALLOS?: string // fallos seguidos para abrir el circuito (3)
  IA_CIRCUITO_MIN?: string // minutos que se salta el proveedor (5)
  GEMINI_MODEL_RESPALDO?: string // segundo modelo de Gemini (gemini-3.5-flash-lite)
  GROQ_MODELOS_VISION?: string // lista; por defecto qwen/qwen3.8-27b
  GROQ_MODELOS_TEXTO?: string // lista; por defecto openai/gpt-oss-20b,openai/gpt-oss-120b
  WORKERS_AI_MODELOS_VISION?: string
  WORKERS_AI_MODELOS_TEXTO?: string
  IA_TRUJILLO?: string // "1" activa Trujillo AI (feature flag)
  TRUJILLO_AI_URL?: string // https://ai.trujillomingorance.com
  TRUJILLO_AI_MODELO_VISION?: string
  TRUJILLO_AI_MODELO_TEXTO?: string
  /** Service Binding opcional al Worker de Trujillo AI (mismo account). */
  TRUJILLO_AI?: Fetcher

  // Secretos
  AUTH_SECRET?: string
  TURNSTILE_SECRET_KEY?: string
  BREVO_API_KEY?: string
  GEMINI_API_KEY?: string
  GROQ_API_KEY?: string
  TRUJILLO_AI_TOKEN?: string
  /** Solo en preview: habilita POST /api/ia/diagnostico (cabecera X-Diag-Token). */
  IA_DIAG_TOKEN?: string
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
