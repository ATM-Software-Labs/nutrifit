# Checklist de lanzamiento · NutriFit

Los 10 puntos críticos antes de anunciar `https://nutri.trujillomingorance.com`.
Marca cada uno solo cuando hayas hecho la comprobación indicada.

| # | Punto | Estado |
|---|---|---|
| 1 | DNS propagado + SSL Full (strict) | ☐ |
| 2 | Brevo entrega (SPF, DKIM y DMARC = pass) | ☐ |
| 3 | Migraciones D1 aplicadas en remoto | ☐ |
| 4 | Secretos configurados | ☐ |
| 5 | Turnstile funcionando en producción | ☐ |
| 6 | Gemini + respaldo Workers AI probados (licencia Llama aceptada) | ☐ |
| 7 | PWA instalable en iOS | ☐ |
| 8 | APK: descarga + instalación + login | ☐ |
| 9 | Cabeceras de seguridad | ☐ |
| 10 | Rate limits verificados | ☐ |

---

## 1. DNS propagado y SSL estricto

- Cloudflare → Pages → *nutrifit* → **Custom domains**: `nutri.trujillomingorance.com` en estado **Active**.
- SSL/TLS → Overview: **Full (strict)**. Edge Certificates: *Always Use HTTPS* activado.

```bash
dig +short nutri.trujillomingorance.com           # IPs de Cloudflare
curl -sI http://nutri.trujillomingorance.com | head -3     # 301 → https
curl -s https://nutri.trujillomingorance.com/api/health    # {"ok":true,…,"db":true}
curl -s https://nutrifit-ac9.pages.dev/api/health
```

## 2. Brevo: entrega y autenticación

- Brevo → *Senders, Domains & Dedicated IPs* → `trujillomingorance.com` **autenticado** (registros TXT de Brevo, DKIM y DMARC añadidos en Cloudflare DNS).
- El remitente `nutrifit@trujillomingorance.com` está verificado y la respuesta va a `soporte@trujillomingorance.com`.
- Pide un enlace a una cuenta de **Gmail** y otra de **Outlook**:
  - llega a la bandeja de entrada, no a spam;
  - en Gmail, «Mostrar original» indica `SPF: PASS`, `DKIM: PASS` y `DMARC: PASS`.
- Opcional: <https://www.mail-tester.com> (puntuación ≥ 9/10).

```bash
dig +short TXT trujillomingorance.com | grep -i spf
dig +short TXT _dmarc.trujillomingorance.com
```

## 3. Migraciones D1 en remoto

```bash
npm run db:migrate:remote        # aplica 0001_init y 0002_tokens_app
npx wrangler d1 migrations list nutrifit-db --remote      # ninguna pendiente
npx wrangler d1 execute nutrifit-db --remote --command "SELECT name FROM sqlite_master WHERE type='table'"
# → usuarios, diario_comidas, historico_peso, registro_agua, magic_tokens, rate_limits, tokens_app
```

## 4. Secretos

```bash
npx wrangler pages secret list --project-name nutrifit
# → AUTH_SECRET, TURNSTILE_SECRET_KEY, BREVO_API_KEY, GEMINI_API_KEY
```

- `AUTH_SECRET` debe ser aleatorio y de ≥ 32 caracteres. Si falta, la API responde 500 «Error de configuración» (falla cerrada).
- Ningún secreto en git: `git grep -nE "xkeysib-|AIza|0x4AAAA[A-Za-z0-9_-]{20,}"` no debe devolver nada salvo la site key pública.
- GitHub (para el APK firmado): `gh secret list` → los 4 `ANDROID_*`.

## 5. Turnstile en producción

- Widget en modo **Invisible**, hostnames `nutri.trujillomingorance.com`, `nutrifit-ac9.pages.dev` y `localhost` (WebView del APK).
- En la web de producción, pide un enlace. En DevTools → Red, `POST /api/auth/solicitar` debe devolver 200 y llevar la cabecera `CF-Turnstile-Token`.
- Una petición sin token debe fallar:

```bash
curl -s -X POST https://nutri.trujillomingorance.com/api/auth/solicitar \
  -H 'Origin: https://nutri.trujillomingorance.com' -H 'Content-Type: application/json' \
  -d '{"email":"prueba@example.com"}'      # → 403 turnstile_requerido
```

- Cloudflare → Turnstile → Analytics: aparecen *solves* del widget.

## 6. IA: Gemini, Groq, Trujillo y Workers AI

- `GEMINI_API_KEY` configurada. Analiza una foto real desde la app: la respuesta lleva `"proveedor":"gemini"`.
- Licencia de Llama 3.2 Vision aceptada (una vez, ver BACKEND.md §5). Para probar el respaldo:
  1. Quita temporalmente la clave (`wrangler pages secret delete GEMINI_API_KEY`) o pon una inválida en un despliegue de *preview*.
  2. Con `GROQ_API_KEY`, la misma foto responde `"proveedor":"groq"`. Sin Groq ni Trujillo, `"proveedor":"workers-ai"`.
  3. Restaura la clave.
- Sin ningún proveedor, la app ofrece «Añadir manualmente» (503).
- Revisa los términos del nivel gratuito de Gemini y la [política de privacidad](../PRIVACIDAD.md) (borrador).

## 7. PWA instalable en iOS

- En un iPhone, abre la web en **Safari**:
  - aparece el banner «Instala NutriFit»;
  - Compartir → «Añadir a pantalla de inicio» → icono correcto y nombre «NutriFit».
- La app abre a pantalla completa (sin barra de Safari), con la barra de estado legible en claro y en oscuro.
- Modo avión: la app abre y muestra «Sin conexión» con «Reintentar» (shell del Service Worker).
- En Chrome de escritorio: DevTools → Application → Manifest sin errores. Lighthouse → PWA «Installable».

## 8. APK: descarga, instalación y login

- Publica el tag `v1.0.0` → Actions «Compilar APK» en verde. La Release contiene `NutriFit.apk` firmado: el resumen del job muestra el certificado (no *Android Debug*).
- `public/.well-known/assetlinks.json` tiene la SHA-256 del keystore de release y está desplegado:
  - `curl -s https://nutri.trujillomingorance.com/.well-known/assetlinks.json`
  - o la herramienta *Statement List Tester* de Google.
- En un Android:
  1. `/descargar` → «Descargar APK Directo» → instalar (permitiendo fuentes desconocidas).
  2. Pide un enlace desde la app → abre el correo en el mismo móvil → **se abre NutriFit con la sesión iniciada** (App Link).
  3. Comprueba la verificación: `adb shell pm get-app-links com.trujillomingorance.nutrifit` → `verified`.
  4. Prueba el respaldo: con el App Link sin verificar, `/app-login` → «Abrir en la app».
- Dentro de la app: añadir comida, foto (Turnstile en el WebView), agua y peso. «Cerrar sesión» revoca el token: una petición con el token viejo devuelve 401.

## 9. Cabeceras de seguridad

- <https://securityheaders.com/?q=nutri.trujillomingorance.com> → **A** o superior.
- <https://observatory.mozilla.org> → sin fallos de CSP.
- La consola del navegador no muestra violaciones de CSP en login, onboarding, panel, foto y ajustes.

```bash
curl -sI https://nutri.trujillomingorance.com | grep -iE "content-security|strict-transport|x-frame|x-content|referrer|permissions"
curl -sI https://nutri.trujillomingorance.com/api/health | grep -iE "content-security|cache-control"
# CORS solo para la app:
curl -s -o /dev/null -w "%{http_code}\n" -X OPTIONS https://nutri.trujillomingorance.com/api/agua -H 'Origin: https://evil.example'   # 403
curl -sI -X OPTIONS https://nutri.trujillomingorance.com/api/agua -H 'Origin: https://localhost' | grep -i access-control-allow-origin
```

## 10. Rate limits

- Pide 6 enlaces seguidos con el mismo email: el 6.º devuelve 429 y la app muestra «Has pedido demasiados enlaces…».
- Analiza 11 fotos en un día con una cuenta de prueba: la 11.ª devuelve 429 con «límite de 10 análisis diarios» y se ofrece la entrada manual.
- El límite de 20 análisis/min por IP se aplica en el middleware antes de llamar a la IA (ver BACKEND.md).
- Al terminar las pruebas, limpia los contadores:

```bash
npx wrangler d1 execute nutrifit-db --remote --command "DELETE FROM rate_limits"
```
