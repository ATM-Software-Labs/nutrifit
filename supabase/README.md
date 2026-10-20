# Supabase · base de datos secundaria de NutriFit

D1 (Cloudflare) sigue siendo la base principal. Supabase aporta:

| Uso | Tablas / funciones | Quién escribe |
| --- | --- | --- |
| Copia diaria de D1 | `bk_filas`, `bk_ejecuciones`, `bk_resumen()` | `POST /api/interno/copia` (GitHub Actions, 03:10 Madrid) |
| Catálogo de productos y genéricos | `catalogo_alimentos` | escáner, búsqueda y productos propios (en segundo plano) + carga inicial |
| Catálogo de platos/recetas | `catalogo_comidas`, `nf_registrar_comida()` | recetas calculadas + platos registrados (sin datos personales) |
| Afinado de la IA | `nf_coincidencias(text[])` (pg_trgm) | lectura desde el análisis de fotos y texto |
| Anti-pausa y salud | `nf_latido()`, `nf_tamanos()` | ronda del cron cada 15 min |

Todas con RLS activado, sin políticas, y permisos solo para `service_role`.

## Puesta en marcha

1. Supabase → SQL Editor → pegar `migrations/20261020120000_copia_y_catalogo.sql` → Run (idempotente).
2. Carga inicial del catálogo (≈300 000 productos de España/UE, ≈7 000 genéricos y ≈600 recetas):
   ```bash
   python3 scripts/supabase/generar_catalogo.py off_eu.jsonl genericos.jsonl carga 300000
   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=… node scripts/supabase/cargar_catalogo.mjs carga
   ```
3. Secretos de Pages (producción y preview): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ALERTAS_EMAIL`.

Si Supabase no responde (timeout 1,5 s, circuito de 60 s), la app sigue con D1, Open Food Facts,
USDA y la IA; `/api/salud` y Ajustes › Acerca de lo muestran y, tras 30 min caído (o al detectar
la pausa), se envía un correo a `ALERTAS_EMAIL` con el enlace al panel.
