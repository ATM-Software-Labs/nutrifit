/**
 * Cabeceras OWASP ASVS para respuestas de NutriFit.
 * La política de documento vive también en public/_headers (los estáticos no
 * pasan por Pages Functions). Las dos copias deben decir lo mismo.
 *
 * Respecto a la CSP pedida se añaden solo orígenes que la app ya usa:
 *   · img-src data: y blob: → miniaturas y fotos locales en <img src>
 *   · connect-src data: y blob: → el mismo origen local, sin salir a la red
 *   · frame-src y connect-src de challenges.cloudflare.com → widget Turnstile
 *   · worker-src 'self' blob: → canvas-confetti
 *   · connect-src api.trujillomingorance.com → foto del escáner, con ticket
 *   · font-src y object-src → fuente autoalojada y plugins
 * style-src lleva 'unsafe-inline' porque la UI usa estilos en el elemento
 * (barras, gráficas). No hay script inline: boot.js y el bundle son 'self'.
 */
export const CSP_DOCUMENTO = [
  "default-src 'self'",
  "script-src 'self' https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self'",
  "connect-src 'self' data: blob: https://generativelanguage.googleapis.com https://api.groq.com https://challenges.cloudflare.com https://ai.trujillomingorance.com https://api.trujillomingorance.com",
  "frame-src https://challenges.cloudflare.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'self'",
].join('; ')

/** La API no es un documento: ni scripts ni estilos. */
export const CSP_API = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"

export const PERMISSIONS_POLICY = 'camera=(self), microphone=(), geolocation=(), payment=()'
export const HSTS = 'max-age=31536000; includeSubDomains; preload'
export const REFERRER = 'strict-origin-when-cross-origin'

export function aplicarCabecerasAsvs(headers: Headers, csp: string) {
  headers.set('Content-Security-Policy', csp)
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('X-Frame-Options', 'DENY')
  headers.set('Permissions-Policy', PERMISSIONS_POLICY)
  headers.set('Strict-Transport-Security', HSTS)
  // Un enlace mágico puede pedir no-referrer para no filtrar el token. El resto usa el valor estricto.
  if (headers.get('Referrer-Policy') !== 'no-referrer') headers.set('Referrer-Policy', REFERRER)
  headers.set('Cross-Origin-Resource-Policy', 'same-origin')
  headers.set('Cross-Origin-Opener-Policy', 'same-origin')
}
