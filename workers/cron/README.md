# nutrifit-cron

Ronda de recordatorios de NutriFit cada 15 minutos. Misma D1 (`nutrifit-db`) que Pages.

## Qué hace
Para cada usuario (`index.ts` → `ejecutar`):
- Hora local en su zona (`recordatorios_pref.zona`, por defecto Europe/Madrid) y horas de silencio.
- Comidas (desayuno, comida, cena, snack) **solo si esa comida no está registrada hoy**; ventana de 45 min tras la hora.
- Cierre del día, racha en peligro (1 h antes del cierre), objetivo del día (calorías > 115 % o proteína < 60 %), agua (17:00), reenganche (3+ días sin registrar, 1 por semana), bienvenida días 1 y 3, resumen del lunes 9:00.
- Canales por tipo (`canales_json`): Web Push (VAPID, `functions/utils/webpush.ts`), correo (Brevo vía `/api/interno/correo`) y centro de notificaciones (`notificaciones_app`).
- Máximo diario (`max_dia`) e idempotencia con `recordatorios_envios (usuario, fecha, clave)`.

Lógica pura y tests: `functions/utils/recordatorios.ts`, `tests/recordatorios.test.ts`.

## Cómo se dispara hoy
La cuenta de Cloudflare está en el plan gratuito y ya usa sus **5 Cron Triggers** en otros Workers, así que:
- El script `nutrifit-cron` está subido (sin trigger).
- Mientras tanto, **GitHub Actions** (`.github/workflows/recordatorios.yml`, `*/15 * * * *`) llama a `POST /api/interno/cron` con la cabecera `x-cron-secret` (secreto `CRON_SECRET` en Pages y en el repo). Ejecuta exactamente `ejecutar()`.

Para pasar al Cron Trigger nativo (más puntual): libera un cron o pasa a Workers Paid y ejecuta
```
cd workers/cron && wrangler deploy
wrangler secret put VAPID_PRIVATE_JWK && wrangler secret put CRON_SECRET   # y VAPID_PUBLIC_KEY en [vars]
```
y desactiva el workflow.

## Secretos
`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_JWK`, `VAPID_SUBJECT`, `CRON_SECRET` (Pages y Worker). Copia local de las claves VAPID en `/workspace/nutrifit-secrets/vapid.json` (fuera del repo). Si se regeneran las VAPID, todas las suscripciones push dejan de valer.
