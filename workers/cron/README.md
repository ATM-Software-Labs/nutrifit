# nutrifit-cron

Ronda de recordatorios de NutriFit cada 5 minutos. Misma D1 (`nutrifit-db`) que Pages.

## Qué hace
Para cada usuario (`index.ts` → `ejecutar`):
- Hora local en su zona (`recordatorios_pref.zona`, por defecto Europe/Madrid) y horas de silencio.
- **Franjas por comida** (`recordatorios_franjas`, lógica en `functions/utils/franjas.ts`): desayuno, media mañana, comida, merienda, cena y comidas propias, cada una con inicio–fin, días y "avisar al final" o "X min tras el inicio". Si a esa hora no hay nada apuntado de ese tipo (ni "Ya comí"/"Saltar hoy" desde la notificación), un aviso por franja y día (`f:<id>`). Tolera rondas tardías hasta fin + 90 min sin pisar la siguiente franja. Notificación apta para reloj: etiqueta por comida, vibración y botones "Ya comí" / "Saltar hoy" (→ `POST /api/recordatorios/accion`, token firmado 36 h) y "Apuntar" (abre `/?apuntar=<tipo>`).
- Cierre del día, racha en peligro (1 h antes del cierre), objetivo del día (calorías > 115 % o proteína < 60 %), agua (17:00), reenganche (3+ días sin registrar, 1 por semana), bienvenida días 1 y 3, resumen del lunes 9:00.
- Canales por tipo (`canales_json`): Web Push (VAPID, `functions/utils/webpush.ts`), correo (Brevo vía `/api/interno/correo`) y centro de notificaciones (`notificaciones_app`).
- Máximo diario (`max_dia`) e idempotencia con `recordatorios_envios (usuario, fecha, clave)`.

Lógica pura y tests: `functions/utils/recordatorios.ts`, `tests/recordatorios.test.ts`.

## Cómo se dispara hoy
La cuenta de Cloudflare está en el plan gratuito y ya usa sus **5 Cron Triggers**, y el cron de GitHub Actions llega con horas de retraso, así que:
- **Reloj** (`reloj.ts`): Durable Object SQLite (gratis) con una alarma cada 5 min (+20 s). En cada alarma se rearma primero y luego llama a `POST {APP_URL}/api/interno/cron` con `x-cron-secret`. Ahí Pages ejecuta `ejecutar()` de `index.ts` y el latido de Supabase.
- `worker.ts` es la entrada: `POST https://nutrifit-cron.<subdominio>.workers.dev/armar` (con `x-cron-secret`) arma la alarma si no lo está y devuelve la próxima y el resultado de la última.
- **GitHub Actions** (`.github/workflows/recordatorios.yml`) queda de respaldo: llama a `/api/interno/cron` y a `/armar`. Todo es idempotente.

Despliegue: `cd workers/cron && wrangler deploy` (+ `wrangler secret put CRON_SECRET`, el mismo que en Pages) y una llamada a `/armar`.

## Secretos
`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_JWK`, `VAPID_SUBJECT`, `AUTH_SECRET` (firma los botones de la notificación) y `CRON_SECRET` en Pages; el Worker solo necesita `CRON_SECRET`. Copia local de las claves VAPID en `/workspace/nutrifit-secrets/vapid.json` (fuera del repo). Si se regeneran las VAPID, todas las suscripciones push dejan de valer.
