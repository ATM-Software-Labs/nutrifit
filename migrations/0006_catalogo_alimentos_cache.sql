-- NutriFit · 0006 — caché del catálogo de alimentos (Open Food Facts y BEDCA).
-- Solo datos públicos de composición. Nunca productos propios ni datos de usuario.
-- TTL de aplicación: 30 días (expira_en). La clave es la consulta, no el usuario,
-- así una lectura repetida es un SELECT por clave primaria.
--   b:<código>   producto por código de barras
--   q:<término>  búsqueda (España + frescos BEDCA si aplica)
CREATE TABLE IF NOT EXISTS catalogo_alimentos_cache (
  clave        TEXT PRIMARY KEY CHECK (length(clave) BETWEEN 3 AND 120),
  tipo         TEXT NOT NULL CHECK (tipo IN ('barcode', 'buscar')),
  datos        TEXT NOT NULL CHECK (json_valid(datos) AND length(datos) <= 200000),
  expira_en    INTEGER NOT NULL,
  actualizado  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_catalogo_alimentos_expira ON catalogo_alimentos_cache (expira_en);
