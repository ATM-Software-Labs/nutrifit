-- Migration number: 0004 	 NutriFit · productos propios (escáner) y caché de Open Food Facts
-- Aplicar:  npm run db:migrate:local   |   npm run db:migrate:remote
-- (La base de alimentos genéricos con FTS5 va en OTRA BD, nutrifit-alimentos:
--  D1 no exporta BDs con tablas virtuales y aquí queremos poder hacer backups.)

-- ---------------------------------------------------------- cache_off
-- Respuestas normalizadas de Open Food Facts (nunca datos del usuario).
--   clave: 'p:<código>' (producto) · 'q:<término normalizado>' (búsqueda)
--   datos: JSON normalizado; 'null' = el código no existe en OFF (caché negativa corta)
-- Productos encontrados: 30 días; no encontrados: 1 día; búsquedas: 1 día.
-- Si OFF falla se sirve la copia caducada (mejor un dato de hace días que nada).
CREATE TABLE IF NOT EXISTS cache_off (
  clave        TEXT PRIMARY KEY CHECK (length(clave) <= 80),
  datos        TEXT NOT NULL CHECK (json_valid(datos)),
  expira_en    INTEGER NOT NULL,                           -- epoch s
  actualizado  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_cache_off_expira ON cache_off (expira_en);

-- ---------------------------------------------------------- productos_usuario
-- Productos que el usuario crea a partir de la foto de la etiqueta (p. ej. un
-- código de barras que no está en Open Food Facts). Privados: solo los ve su dueño.
-- Valores por 100 g (o 100 ml).
CREATE TABLE IF NOT EXISTS productos_usuario (
  id             TEXT PRIMARY KEY,                         -- UUID v4
  usuario_id     TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  codigo         TEXT CHECK (codigo IS NULL OR codigo GLOB '[0-9]*' AND length(codigo) BETWEEN 8 AND 14),
  nombre         TEXT NOT NULL CHECK (length(nombre) BETWEEN 1 AND 100),
  marca          TEXT CHECK (marca IS NULL OR length(marca) <= 60),
  calorias       REAL NOT NULL CHECK (calorias BETWEEN 0 AND 950),
  proteinas      REAL NOT NULL CHECK (proteinas BETWEEN 0 AND 100),
  carbohidratos  REAL NOT NULL CHECK (carbohidratos BETWEEN 0 AND 100),
  grasas         REAL NOT NULL CHECK (grasas BETWEEN 0 AND 100),
  azucares       REAL CHECK (azucares IS NULL OR azucares BETWEEN 0 AND 100),
  saturadas      REAL CHECK (saturadas IS NULL OR saturadas BETWEEN 0 AND 100),
  fibra          REAL CHECK (fibra IS NULL OR fibra BETWEEN 0 AND 100),
  sal            REAL CHECK (sal IS NULL OR sal BETWEEN 0 AND 100),
  racion_g       REAL CHECK (racion_g IS NULL OR racion_g BETWEEN 1 AND 2000),
  envase_g       REAL CHECK (envase_g IS NULL OR envase_g BETWEEN 1 AND 10000),
  unidad         TEXT NOT NULL DEFAULT 'g' CHECK (unidad IN ('g', 'ml')),
  creado_en      INTEGER NOT NULL DEFAULT (unixepoch()),
  actualizado_en INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_productos_usuario_codigo ON productos_usuario (usuario_id, codigo) WHERE codigo IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_productos_usuario_usuario ON productos_usuario (usuario_id, actualizado_en);
