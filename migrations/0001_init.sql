-- Migration number: 0001 	 NutriFit · esquema inicial
-- Aplicar:  npm run db:migrate:local   |   npm run db:migrate:remote
-- Notas:
--   · D1 aplica las claves foráneas (ON DELETE CASCADE) por defecto.
--   · Fechas de negocio en TEXT 'YYYY-MM-DD' (día local del usuario).
--   · Tablas de seguridad con marcas de tiempo epoch (segundos, INTEGER).

-- ---------------------------------------------------------------- usuarios
CREATE TABLE IF NOT EXISTS usuarios (
  id               TEXT PRIMARY KEY,                       -- UUID v4
  email            TEXT NOT NULL UNIQUE COLLATE NOCASE,
  nombre           TEXT CHECK (nombre IS NULL OR length(nombre) <= 60),
  edad             INTEGER CHECK (edad IS NULL OR edad BETWEEN 14 AND 100),
  sexo             TEXT CHECK (sexo IS NULL OR sexo IN ('hombre', 'mujer')),
  peso_kg          REAL CHECK (peso_kg IS NULL OR peso_kg BETWEEN 30 AND 300),
  altura_cm        REAL CHECK (altura_cm IS NULL OR altura_cm BETWEEN 120 AND 230),
  nivel_actividad  TEXT CHECK (nivel_actividad IS NULL OR nivel_actividad IN ('sedentario', 'ligero', 'moderado', 'activo')),
  objetivo         TEXT CHECK (objetivo IS NULL OR objetivo IN ('deficit', 'mantenimiento', 'superavit')),
  meta_calorias    INTEGER CHECK (meta_calorias IS NULL OR meta_calorias BETWEEN 800 AND 8000),
  meta_proteinas   INTEGER CHECK (meta_proteinas IS NULL OR meta_proteinas >= 0),
  meta_carbs       INTEGER CHECK (meta_carbs IS NULL OR meta_carbs >= 0),
  meta_grasas      INTEGER CHECK (meta_grasas IS NULL OR meta_grasas >= 0),
  creado_en        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en   TEXT
);

-- ---------------------------------------------------------- diario_comidas
CREATE TABLE IF NOT EXISTS diario_comidas (
  id                 TEXT PRIMARY KEY,                     -- UUID v4
  usuario_id         TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo_comida        TEXT NOT NULL CHECK (tipo_comida IN ('desayuno', 'comida', 'cena', 'snack')),
  descripcion        TEXT NOT NULL CHECK (length(descripcion) BETWEEN 1 AND 200),
  calorias           REAL NOT NULL DEFAULT 0 CHECK (calorias BETWEEN 0 AND 10000),
  proteinas          REAL NOT NULL DEFAULT 0 CHECK (proteinas BETWEEN 0 AND 1000),
  carbohidratos      REAL NOT NULL DEFAULT 0 CHECK (carbohidratos BETWEEN 0 AND 2000),
  grasas             REAL NOT NULL DEFAULT 0 CHECK (grasas BETWEEN 0 AND 1000),
  ingredientes_json  TEXT CHECK (ingredientes_json IS NULL OR json_valid(ingredientes_json)),
  imagen_url         TEXT CHECK (imagen_url IS NULL OR length(imagen_url) <= 500),
  fecha              TEXT NOT NULL CHECK (fecha GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  creado_en          TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_diario_usuario_fecha ON diario_comidas (usuario_id, fecha);

-- ---------------------------------------------------------- historico_peso
CREATE TABLE IF NOT EXISTS historico_peso (
  id          TEXT PRIMARY KEY,                            -- UUID v4
  usuario_id  TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  peso        REAL NOT NULL CHECK (peso BETWEEN 30 AND 300),
  fecha       TEXT NOT NULL CHECK (fecha GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  creado_en   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (usuario_id, fecha)                               -- también sirve de índice (usuario_id, fecha)
);

-- ---------------------------------------------------------- registro_agua
CREATE TABLE IF NOT EXISTS registro_agua (
  usuario_id      TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  fecha           TEXT NOT NULL CHECK (fecha GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  ml              INTEGER NOT NULL DEFAULT 0 CHECK (ml BETWEEN 0 AND 10000),
  actualizado_en  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (usuario_id, fecha)
);

-- ================================================================ SEGURIDAD
-- Magic links de un solo uso. Se guarda SOLO el hash SHA-256 del jti, nunca
-- el token: una filtración de la BD no permite iniciar sesión.
CREATE TABLE IF NOT EXISTS magic_tokens (
  jti_hash   TEXT PRIMARY KEY,                             -- hex(SHA-256(jti))
  email      TEXT NOT NULL COLLATE NOCASE,
  expira_en  INTEGER NOT NULL,                             -- epoch s
  usado_en   INTEGER,                                      -- epoch s; NULL = sin usar
  creado_en  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_magic_tokens_expira ON magic_tokens (expira_en);

-- Limitador de peticiones por ventana fija (upsert atómico).
CREATE TABLE IF NOT EXISTS rate_limits (
  clave           TEXT PRIMARY KEY,                        -- p.ej. 'auth:ip:<hash>'
  ventana_inicio  INTEGER NOT NULL,                        -- epoch s (inicio de la ventana)
  contador        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_ventana ON rate_limits (ventana_inicio);
