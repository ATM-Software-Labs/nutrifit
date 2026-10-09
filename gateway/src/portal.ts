/**
 * GET / de api.trujillomingorance.com.
 * Página estática. No nombra servicios, rutas ni secretos.
 * No pasa por cerrar(): el HSTS de la API no lleva preload y la API no se cachea.
 */

export const HSTS_PORTAL = 'max-age=31536000; includeSubDomains; preload'
export const CACHE_PORTAL = 'public, max-age=3600, s-maxage=86400'

const HTML_PORTAL = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive, nosnippet">
<meta name="referrer" content="strict-origin-when-cross-origin">
<title>TRUJILLO MINGORANCE · Edge Gateway</title>
<style>
  :root {
    color-scheme: dark;
    --fondo: #090d16;
    --tinta: #e8eef6;
    --muted: #8b97a8;
    --linea: rgba(16, 185, 129, 0.28);
    --esmeralda: #10b981;
    --card: #0c121c;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; min-height: 100%; }
  body {
    font-family: "Segoe UI", system-ui, sans-serif;
    background:
      radial-gradient(900px 420px at 50% -10%, rgba(16, 185, 129, 0.14), transparent 60%),
      var(--fondo);
    color: var(--tinta);
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }
  header, footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 22px 28px;
  }
  .marca {
    display: flex;
    align-items: center;
    gap: 12px;
    letter-spacing: 0.16em;
    font-size: 12px;
    font-weight: 620;
  }
  .tag {
    font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
    letter-spacing: 0;
    font-size: 11px;
    font-weight: 450;
    color: var(--esmeralda);
    border: 1px solid var(--linea);
    border-radius: 4px;
    padding: 3px 7px;
  }
  .presencia {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--muted);
    font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
    font-size: 12px;
  }
  .pulso {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--esmeralda);
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.65);
    animation: pulso 2.4s ease-out infinite;
  }
  @keyframes pulso {
    70% { box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
    100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
  }
  main {
    flex: 1;
    display: grid;
    place-items: center;
    padding: 24px 20px 48px;
  }
  .card {
    width: min(640px, 100%);
    background: var(--card);
    border: 1px solid var(--linea);
    border-radius: 16px;
    padding: 36px 32px 28px;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
  }
  h1 {
    margin: 0;
    font-size: 28px;
    font-weight: 600;
    letter-spacing: -0.02em;
  }
  .estado {
    display: inline-flex;
    margin-top: 16px;
    font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
    font-size: 13px;
    color: var(--esmeralda);
    border: 1px solid var(--linea);
    border-radius: 999px;
    padding: 6px 12px;
  }
  dl { margin: 28px 0 0; }
  dl div {
    display: grid;
    grid-template-columns: 148px 1fr;
    gap: 12px;
    padding: 12px 0;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }
  dt {
    margin: 0;
    color: var(--muted);
    font-size: 13px;
  }
  dd {
    margin: 0;
    font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
    font-size: 13px;
  }
  p {
    margin: 26px 0 0;
    color: var(--muted);
    font-size: 14px;
    line-height: 1.6;
  }
  footer {
    color: var(--muted);
    font-size: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
  }
  @media (max-width: 640px) {
    header, footer { flex-direction: column; align-items: flex-start; }
    .card { padding: 28px 20px; }
    dl div { grid-template-columns: 1fr; gap: 4px; }
    h1 { font-size: 24px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .pulso { animation: none; }
  }
</style>
</head>
<body>
<header>
  <div class="marca">TRUJILLO MINGORANCE <span class="tag">gateway.edge</span></div>
  <div class="presencia"><span class="pulso" aria-hidden="true"></span> Global Edge Anycast</div>
</header>
<main>
  <article class="card">
    <h1>Edge Gateway Protocol</h1>
    <p class="estado">200 OK — Active</p>
    <dl>
      <div><dt>Region</dt><dd>Cloudflare Anycast Network</dd></div>
      <div><dt>Ingress Policy</dt><dd>Restricted / Mutual Auth Only</dd></div>
      <div><dt>Encryption</dt><dd>TLS 1.3 / Strict HSTS</dd></div>
    </dl>
    <p>Servicio de interconexión perimetral y enrutamiento seguro de servicios para trujillomingorance.com. El tráfico no verificado es analizado y descartado por los cortafuegos del borde.</p>
  </article>
</main>
<footer>© 2026 Alberto Trujillo Mingorance. All rights reserved.</footer>
</body>
</html>
`

export function respuestaPortal(): Response {
  return new Response(HTML_PORTAL, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=UTF-8',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'referrer-policy': 'strict-origin-when-cross-origin',
      'strict-transport-security': HSTS_PORTAL,
      'cache-control': CACHE_PORTAL,
      'x-robots-tag': 'noindex, nofollow, noarchive, nosnippet',
      'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; script-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    },
  })
}
