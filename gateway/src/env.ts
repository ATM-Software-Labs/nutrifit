/** Bindings del Worker api.trujillomingorance.com. Los secretos no se versionan. */
export interface GatewayEnv {
  /** 5 peticiones / 60 s. Si falta, la visión se cierra (no queda abierta). */
  VISION_LIMITE?: RateLimit
  /** Misma D1 que Pages: solo la caché ia:<sha256> del plato. */
  DB?: D1Database
  AI?: Ai
  ENVIRONMENT?: string
  /** Origen Pages al que se reenvía /v1. Solo hosts de la lista en pasarela.ts. */
  PAGES_ORIGIN?: string
  GEMINI_MODEL?: string
  TRUJILLO_MODEL?: string
  TRUJILLO_AI_URL?: string
  AUTH_SECRET?: string
  /** Secreto de servidor. No existe ninguna variable VITE_ con este valor. */
  APP_CLIENT_TOKEN?: string
  GEMINI_API_KEY?: string
  GROQ_API_KEY?: string
  TRUJILLO_API_KEY?: string
}

export interface ContextoGateway {
  waitUntil(promesa: Promise<unknown>): void
}
