/**
 * Bindings y variables de entorno disponibles en las Pages Functions.
 * Descomenta según se vayan configurando en wrangler.toml / panel de Cloudflare.
 */
export interface Env {
  // DB: D1Database          // Cloudflare D1 (binding "DB")
  // AI: Ai                  // Workers AI (binding "AI")
  // GEMINI_API_KEY: string  // secreto (wrangler pages secret put GEMINI_API_KEY)
  // BREVO_API_KEY: string   // secreto (wrangler pages secret put BREVO_API_KEY)
  ENVIRONMENT?: string
}
