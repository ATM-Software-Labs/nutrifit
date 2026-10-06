# Migraciones D1

Aquí irán las migraciones SQL de Cloudflare D1 (`0001_init.sql`, …).

```bash
npx wrangler d1 migrations create nutrifit-db init
npx wrangler d1 migrations apply nutrifit-db --local    # local
npx wrangler d1 migrations apply nutrifit-db --remote   # producción
```
