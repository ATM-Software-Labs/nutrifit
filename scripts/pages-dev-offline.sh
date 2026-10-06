#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# NutriFit · Pages Functions en local SIN cuenta de Cloudflare.
#
# El binding [ai] de wrangler.toml siempre es REMOTO, así que `npm run pages:dev`
# exige `wrangler login`. Este script levanta lo mismo sin Workers AI (el
# análisis de fotos fallará de forma controlada con 503 si no hay GEMINI_API_KEY):
# copia el proyecto a un directorio temporal SIN wrangler.toml y pasa los
# bindings por CLI, reutilizando la BD D1 local de .wrangler/state.
#
# Uso:  npm run build && bash scripts/pages-dev-offline.sh   (requiere .dev.vars)
# -----------------------------------------------------------------------------
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
for d in dist functions src node_modules .dev.vars; do ln -s "$ROOT/$d" "$TMP/$d"; done
cd "$TMP"
# Ids de D1 por nombre (hay dos BDs: nutrifit-db y nutrifit-alimentos).
id_bd() { awk -v n="$1" '$1=="database_name"{gsub(/"/,"",$3); actual=$3} $1=="database_id"&&actual==n{gsub(/"/,"",$3); print $3; exit}' "$ROOT/wrangler.toml"; }
DB_ID="$(id_bd nutrifit-db)"
ALIMENTOS_ID="$(id_bd nutrifit-alimentos)"
exec npx wrangler pages dev dist \
  --port "${PORT:-8788}" --inspector-port "${INSPECTOR_PORT:-9229}" \
  --compatibility-date 2026-10-01 \
  --compatibility-flags nodejs_compat \
  --d1 "DB=$DB_ID" \
  --d1 "ALIMENTOS=$ALIMENTOS_ID" \
  --persist-to "$ROOT/.wrangler/state"
