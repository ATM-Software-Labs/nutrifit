-- NutriFit · 0007 — perfil social, amistades, comidas frecuentes y entrenos.
-- Solo nutrifit-db. No toca nutrifit-alimentos.
-- Las columnas nuevas de usuarios y entrenamientos se AÑADEN: SQLite no
-- reescribe las filas, así que diario_comidas, registro_agua, historico_peso
-- y los entrenos ya guardados siguen igual.
-- ADD COLUMN no admite UNIQUE. El username único va en un índice (varios NULL).

ALTER TABLE usuarios ADD COLUMN username TEXT;
ALTER TABLE usuarios ADD COLUMN bio TEXT CHECK (bio IS NULL OR length(bio) <= 500);
ALTER TABLE usuarios ADD COLUMN avatar_url TEXT CHECK (avatar_url IS NULL OR length(avatar_url) <= 500);
ALTER TABLE usuarios ADD COLUMN banner_url TEXT CHECK (banner_url IS NULL OR length(banner_url) <= 500);
ALTER TABLE usuarios ADD COLUMN es_publico INTEGER NOT NULL DEFAULT 1 CHECK (es_publico IN (0, 1));
ALTER TABLE usuarios ADD COLUMN meta_agua_base_ml INTEGER NOT NULL DEFAULT 2500 CHECK (meta_agua_base_ml BETWEEN 250 AND 10000);

CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_username
  ON usuarios (username COLLATE NOCASE)
  WHERE username IS NOT NULL;

-- ---------------------------------------------------------------- amistades
CREATE TABLE IF NOT EXISTS amistades (
  id              TEXT PRIMARY KEY,
  solicitante_id  TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  receptor_id     TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  estado          TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aceptada', 'rechazada')),
  creado_en       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (solicitante_id, receptor_id),
  CHECK (solicitante_id <> receptor_id)
);
CREATE INDEX IF NOT EXISTS idx_amistades_solicitante ON amistades (solicitante_id);
CREATE INDEX IF NOT EXISTS idx_amistades_receptor ON amistades (receptor_id);

-- ------------------------------------------------------- comidas_frecuentes
CREATE TABLE IF NOT EXISTS comidas_frecuentes (
  id           TEXT PRIMARY KEY,
  usuario_id   TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo_comida  TEXT CHECK (tipo_comida IS NULL OR tipo_comida IN ('desayuno', 'comida', 'cena', 'snack')),
  nombre       TEXT NOT NULL CHECK (length(nombre) BETWEEN 1 AND 200),
  items_json   TEXT CHECK (items_json IS NULL OR (json_valid(items_json) AND length(items_json) <= 20000)),
  creado_en    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_comidas_frecuentes_usuario ON comidas_frecuentes (usuario_id);

-- ------------------------------------------------------------- entrenamientos
-- Si la tabla ya existe (el Worker insertaba en ella sin migración), CREATE
-- no la toca y los ALTER añaden lo que falte. tipo admite también 'deportes'
-- y 'movilidad': la lista de ejercicios ya los envía y un CHECK más estrecho
-- rompería filas históricas. 'fuerza' y 'cardio' se validan en el Worker.
CREATE TABLE IF NOT EXISTS entrenamientos (
  id          TEXT PRIMARY KEY,
  usuario_id  TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL,
  nombre      TEXT,
  minutos     INTEGER,
  calorias    INTEGER,
  origen      TEXT,
  fecha       TEXT NOT NULL,
  creado_en   TEXT NOT NULL DEFAULT (datetime('now'))
);
ALTER TABLE entrenamientos ADD COLUMN duracion_min INTEGER CHECK (duracion_min IS NULL OR duracion_min BETWEEN 1 AND 600);
ALTER TABLE entrenamientos ADD COLUMN intensidad TEXT CHECK (intensidad IS NULL OR intensidad IN ('baja', 'media', 'alta'));
CREATE INDEX IF NOT EXISTS idx_entrenamientos_usuario_fecha ON entrenamientos (usuario_id, fecha);
CREATE INDEX IF NOT EXISTS idx_entrenamientos_fecha ON entrenamientos (fecha);

-- --------------------------------------------------------------- archivos
-- Una fila de D1 cabe en 2_000_000 bytes. El blob se queda en 1_900_000
-- para dejar sitio al id, al dueño y al mime. El id es un UUID del Worker,
-- nunca el nombre que manda el cliente.
CREATE TABLE IF NOT EXISTS archivos_usuario (
  id          TEXT PRIMARY KEY,
  usuario_id  TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  clase       TEXT NOT NULL CHECK (clase IN ('avatar', 'banner', 'plato')),
  mime        TEXT NOT NULL CHECK (mime IN ('image/jpeg', 'image/png', 'image/webp')),
  bytes       INTEGER NOT NULL CHECK (bytes BETWEEN 1 AND 1900000),
  contenido   BLOB NOT NULL,
  creado_en   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_archivos_usuario ON archivos_usuario (usuario_id);

-- Búsquedas por fecha que el índice (usuario_id, fecha) no cubre solo.
CREATE INDEX IF NOT EXISTS idx_diario_fecha ON diario_comidas (fecha);
CREATE INDEX IF NOT EXISTS idx_historico_peso_fecha ON historico_peso (fecha);
CREATE INDEX IF NOT EXISTS idx_registro_agua_fecha ON registro_agua (fecha);

-- Strava no se borra en este archivo: integraciones_apps no está en las
-- migraciones anteriores y su forma real puede variar. Un DELETE con un
-- nombre de columna supuesto tumbaría esta migración. La desvinculación
-- (solo filas de Strava, el resto intacto) está en functions/utils/integraciones.ts
-- y se ejecuta al arrancar /api/auth/yo y al leer /api/integraciones.
