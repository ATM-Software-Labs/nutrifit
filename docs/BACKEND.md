# NutriFit · Backend (Fase 3)

Cloudflare Pages Functions (`/functions`) + D1 + Turnstile + Brevo + Gemini /
Workers AI. Seguridad desde el diseño: validación Zod de todas las entradas,
SQL siempre parametrizado (`prepare().bind()`), sesiones firmadas en cookie
`HttpOnly; Secure; SameSite=Strict`, comprobación de Origin, Turnstile en las
rutas anónimas o caras, y rate limiting en D1.

---

## 1. Endpoints

| Método | Ruta | Auth | Turnstile | Límite | Descripción |
|---|---|---|---|---|---|
| GET | `/api/health` | — | — | — | Vida + ping a D1 |
| GET | `/api/config` | — | — | — | Config pública (`turnstileSiteKey`) |
| POST | `/api/auth/solicitar` | — | **Sí** | 5 / 15 min por IP **y** por email | Envía magic link. Responde siempre el mismo 200 genérico |
| GET | `/api/auth/verificar?token=` | — | — | 30 / 15 min por IP | Valida el enlace (firma, caducidad 15 min, un solo uso), crea el usuario si es nuevo, pone la cookie `nf_session` y redirige 302 a `/` (error → `/?auth=invalido\|caducado\|usado\|limite`) |
| POST | `/api/auth/salir` | (cookie) | — | — | Borra la cookie |
| GET | `/api/auth/yo` | Sí | — | — | Perfil del usuario o 401 |
| POST | `/api/macros/calcular` | — | — | 60 / min por IP | Mifflin-St Jeor → `{tmb, tdee, calorias, proteinas, carbohidratos, grasas}` |
| POST | `/api/usuarios/perfil` | Sí | **Sí** | — | Guarda onboarding + objetivos; la 1.ª vez envía la bienvenida (en segundo plano) |
| POST | `/api/comidas/analizar` | Sí | **Sí** | 20 / min por IP · 10 / día por usuario | Foto (multipart `imagen` o JSON `{imagen: base64\|dataURL}`), ≤ 1,5 MB, JPEG/PNG/WebP reales → `{proveedor, resultado}` |
| POST | `/api/comidas/guardar` | Sí | — | 300 / día por usuario | Inserta una comida |
| GET | `/api/comidas/resumen?fecha=` | Sí | — | — | Comidas por tipo, totales, metas, restante y % (el usuario sale de la cookie, nunca de un parámetro) |
| DELETE | `/api/comidas/:id` | Sí | — | — | Borra solo comidas propias (404 si no existe o no es tuya) |
| POST / GET | `/api/peso` · `?dias=30` | Sí | — | — | Registro / histórico de peso |
| POST / GET | `/api/agua` · `?fecha=` | Sí | — | — | `{fecha, ml, modo: 'sumar'\|'fijar'}` total diario 0–10 000 ml |

Turnstile se envía en la cabecera `CF-Turnstile-Token`, en el campo JSON
`turnstileToken` o en el campo de formulario `turnstileToken` /
`cf-turnstile-response`.

Errores: `{"ok": false, "error": "mensaje en español", "detalles"?: [{campo, mensaje}], "codigo"?: "..."}`
con 400 (validación), 401, 403 (`origen`, `turnstile_requerido`, `turnstile_invalido`),
404, 413, 415, 429 (+ `Retry-After`), 503 (`ia_no_disponible`), 500 (sin detalles internos).

### Modelo de seguridad (resumen)

- **`functions/_middleware.ts`** (solo `/api/*` gracias a `public/_routes.json`):
  - carga la sesión;
  - en POST/PUT/PATCH/DELETE exige que `Origin` esté en la lista permitida (su propio origen + `ALLOWED_ORIGINS`), rechaza `Sec-Fetch-Site: cross-site` y solo acepta JSON o multipart;
  - aplica Turnstile y el límite de `analizar`;
  - añade cabeceras de seguridad;
  - devuelve errores genéricos.
- **Escrituras autenticadas sin Turnstile** (`guardar`, `peso`, `agua`, `DELETE`, `salir`): se protegen con sesión + `SameSite=Strict` + Origin. Pedir Turnstile en cada guardado sería impracticable.
- **Magic links:** el token es `base64url(payload).HMAC-SHA256`, con claves derivadas por propósito (un token de sesión nunca vale como enlace y viceversa). En D1 solo se guarda `SHA-256(jti)`. El consumo es atómico (`UPDATE … WHERE usado_en IS NULL RETURNING`). La URL del enlace sale de `APP_URL`, nunca de la cabecera `Host`.
- **Rate limit:** ventana fija con un único `INSERT … ON CONFLICT DO UPDATE … RETURNING` (atómico). Las claves llevan hash de IP/email, nunca en claro.
- **Cabeceras de los estáticos:** `public/_headers` (CSP sin `unsafe-inline`, HSTS, etc.). Las respuestas de la API tienen las suyas propias (`default-src 'none'`).

---

## 2. Base de datos D1

```bash
npx wrangler login
npx wrangler d1 create nutrifit-db
# → copia el database_id que imprime en wrangler.toml ([[d1_databases]] → database_id)

npm run db:migrate:local    # BD local (.wrangler/state) para desarrollo
npm run db:migrate:remote   # BD de producción
```

Tablas: `usuarios`, `diario_comidas`, `historico_peso`, `registro_agua`,
`magic_tokens`, `rate_limits` (ver `migrations/0001_init.sql`). Para cambios
futuros: `npx wrangler d1 migrations create nutrifit-db <nombre>`.

---

## 3. Turnstile (anti-bots)

1. Panel de Cloudflare → **Turnstile** → **Add widget**.
2. *Widget name:* `NutriFit`. *Hostnames:* `nutri.trujillomingorance.com`, `nutrifit.pages.dev` y `localhost` (opcional, para probar con claves reales en local).
3. *Widget mode:* **Managed** (recomendado; solo muestra un reto si sospecha) o **Invisible**.
4. Copia la **Site Key** (pública) en `wrangler.toml` → `TURNSTILE_SITE_KEY`.
5. Guarda la **Secret Key** como secreto:
   ```bash
   npx wrangler pages secret put TURNSTILE_SECRET_KEY --project-name nutrifit
   ```

**Claves de prueba oficiales** (solo desarrollo, ya están en `.dev.vars.example`):

| | Valor |
|---|---|
| Site key (siempre pasa) | `1x00000000000000000000AA` |
| Secret key (siempre pasa) | `1x0000000000000000000000000000000AA` |
| Secret key (siempre falla) | `2x0000000000000000000000000000000AA` |

Con las claves de prueba, el token de prueba es `XXXX.DUMMY.TOKEN.XXXX`. En
producción (`ENVIRONMENT=production`) el servidor **se niega** a funcionar sin
secreto o con un secreto de prueba (falla cerrado con 500).

---

## 4. Secretos

Nunca en git ni en `wrangler.toml`. En local van en `.dev.vars` (copia de `.dev.vars.example`).

| Secreto | Para qué | Cómo obtenerlo |
|---|---|---|
| `AUTH_SECRET` | Firmar sesiones y magic links (≥ 32 caracteres) | `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `TURNSTILE_SECRET_KEY` | Verificar Turnstile | Panel de Turnstile (ver §3) |
| `BREVO_API_KEY` | Enviar emails | Brevo → *SMTP & API* → *API Keys* → *Generate* |
| `GEMINI_API_KEY` | Análisis de fotos (proveedor principal) | Google AI Studio (ver §6) |

```bash
npx wrangler pages secret put AUTH_SECRET          --project-name nutrifit
npx wrangler pages secret put TURNSTILE_SECRET_KEY --project-name nutrifit
npx wrangler pages secret put BREVO_API_KEY        --project-name nutrifit
npx wrangler pages secret put GEMINI_API_KEY       --project-name nutrifit
npx wrangler pages secret list --project-name nutrifit
```

> Cambiar `AUTH_SECRET` invalida todas las sesiones y enlaces pendientes (sirve
> como "cerrar sesión en todos los dispositivos").

**Brevo:** el remitente `hola@nutri.trujillomingorance.com` debe estar
verificado en Brevo (*Senders, Domains & Dedicated IPs* → autenticar el dominio
con los registros DKIM/DMARC que indique Brevo en la zona DNS). Sin
`BREVO_API_KEY` (desarrollo), el magic link se imprime en la consola de Wrangler.

---

## 5. Workers AI (fallback de visión)

Modelo: `@cf/meta/llama-3.2-11b-vision-instruct`. Meta exige aceptar su licencia
y su política de uso aceptable **una sola vez por cuenta**, enviando el prompt
`agree`. Se hace a mano (no automáticamente desde el código, porque aceptar una
licencia es una decisión del titular de la cuenta):

```bash
# Token con permiso "Workers AI: Read/Edit" (Mi perfil → API Tokens)
curl https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/ai/run/@cf/meta/llama-3.2-11b-vision-instruct \
  -X POST -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -d '{ "prompt": "agree" }'
```

Si no se ha aceptado, el log mostrará `[ia] Workers AI exige aceptar la licencia de Meta…`
y la API responderá 503 `ia_no_disponible` (la app ofrece añadir la comida a mano).

El binding `[ai]` siempre es **remoto**: `npm run pages:dev` necesita
`wrangler login`. Para desarrollar sin cuenta: `npm run pages:dev:offline`
(sin Workers AI).

---

## 6. Gemini (proveedor principal)

1. Entra en <https://aistudio.google.com/apikey> → **Create API key** (elige o crea un proyecto de Google Cloud).
2. `npx wrangler pages secret put GEMINI_API_KEY --project-name nutrifit`.
3. Modelo por defecto: **`gemini-3.8-flash`** (Flash estable con free tier, oct-2026). Se cambia sin tocar código en `wrangler.toml` → `GEMINI_MODEL` (p. ej. `gemini-flash-latest`).

Se usa REST `v1beta/models/{modelo}:generateContent` con `inline_data` (imagen
base64), `responseMimeType: application/json` y `responseSchema`. Si Gemini falla
por cualquier motivo (sin clave, 429, 5xx, timeout de 25 s o JSON inválido) se
pasa a Workers AI. La salida de ambos se limpia (fences, prosa, comas
colgantes), se valida con Zod y se redondea a 1 decimal (`functions/utils/iaParseo.ts`).

> Ojo: en el free tier, Google puede usar las entradas para mejorar sus
> productos. Conviene indicarlo en la política de privacidad, o usar el plan de pago.

---

## 7. Desarrollo y pruebas

```bash
cp .dev.vars.example .dev.vars        # y pon un AUTH_SECRET aleatorio
npm run db:migrate:local
npm run pages:dev                     # requiere wrangler login (por el binding AI)
npm run pages:dev:offline             # alternativa sin cuenta de Cloudflare
npm test                              # tests unitarios (Node ≥ 22.18)
npm run typecheck
```

Prueba rápida con curl (servidor en :8788, claves de prueba de Turnstile):

```bash
B=http://localhost:8788
curl -X POST $B/api/auth/solicitar -H "Origin: $B" -H 'content-type: application/json' \
  -d '{"email":"yo@example.com","turnstileToken":"XXXX.DUMMY.TOKEN.XXXX"}'
# → copia el enlace de la consola de Wrangler y ábrelo (o curl -i) para obtener la cookie
```

---

## 8. Pendiente para Capacitor (APK)

En la APK el WebView tiene origen `https://localhost`, por lo que las llamadas a
`https://nutri.trujillomingorance.com/api` son *cross-site*:

- la cookie `SameSite=Strict` no se enviaría;
- el middleware rechazaría ese `Origin`;
- haría falta CORS.

Propuesta (fase Capacitor):

1. **Token Bearer para nativo:**
   - El magic link abre la app mediante Android App Link (`/.well-known/assetlinks.json`), con una ruta del tipo `https://nutri.trujillomingorance.com/app/entrar?token=…`.
   - La app canjea el token en un nuevo `POST /api/auth/token` y recibe un token de sesión firmado (el mismo formato, otro propósito).
   - Lo guarda en almacenamiento seguro (Keystore) y lo envía en `Authorization: Bearer`.
2. **Middleware:**
   - Las peticiones con `Authorization: Bearer` no usan cookie, así que no son vulnerables a CSRF y pueden saltarse la comprobación de Origin.
   - Se añade CORS **solo** para `https://localhost` y `capacitor://localhost`, sin `Access-Control-Allow-Credentials`, con `Authorization, Content-Type, CF-Turnstile-Token` permitidos y respuesta a `OPTIONS`.
3. **Turnstile en el WebView:** añadir `localhost` a los hostnames del widget (o usar *Pre-clearance* / Play Integrity a futuro).
4. **Alternativa rápida:** `CapacitorHttp` (HTTP nativo, sin CORS y con un *cookie jar* nativo donde SameSite no aplica). Es más sencillo, pero mezcla modelos y es más difícil de razonar. Se recomienda la opción Bearer.
