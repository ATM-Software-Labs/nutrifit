-- Logros desbloqueados (idempotente: PK usuario+logro) y suscripciones/preferencias de recordatorios.
CREATE TABLE IF NOT EXISTS usuario_logros (
  usuario_id      TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  logro_id        TEXT NOT NULL CHECK (length(logro_id) <= 40),
  desbloqueado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  visto           INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (usuario_id, logro_id)
);

CREATE TABLE IF NOT EXISTS push_suscripciones (
  endpoint_hash  TEXT PRIMARY KEY,                       -- hex(SHA-256(endpoint))
  usuario_id     TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  endpoint       TEXT NOT NULL CHECK (length(endpoint) <= 1000),
  p256dh         TEXT NOT NULL CHECK (length(p256dh) <= 200),
  auth           TEXT NOT NULL CHECK (length(auth) <= 100),
  creado_en      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fallos         INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_push_usuario ON push_suscripciones (usuario_id);

CREATE TABLE IF NOT EXISTS recordatorios_pref (
  usuario_id     TEXT PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  activo         INTEGER NOT NULL DEFAULT 0,
  zona           TEXT NOT NULL DEFAULT 'Europe/Madrid' CHECK (length(zona) <= 50),
  desayuno       TEXT CHECK (desayuno IS NULL OR desayuno GLOB '[0-2][0-9]:[0-5][0-9]'),
  comida         TEXT CHECK (comida IS NULL OR comida GLOB '[0-2][0-9]:[0-5][0-9]'),
  cena           TEXT CHECK (cena IS NULL OR cena GLOB '[0-2][0-9]:[0-5][0-9]'),
  snack          TEXT CHECK (snack IS NULL OR snack GLOB '[0-2][0-9]:[0-5][0-9]'),
  cierre         TEXT CHECK (cierre IS NULL OR cierre GLOB '[0-2][0-9]:[0-5][0-9]'),
  agua           INTEGER NOT NULL DEFAULT 0,
  email          INTEGER NOT NULL DEFAULT 0,
  resumen_semanal INTEGER NOT NULL DEFAULT 1,
  silencio_desde TEXT NOT NULL DEFAULT '23:00',
  silencio_hasta TEXT NOT NULL DEFAULT '08:00',
  max_dia        INTEGER NOT NULL DEFAULT 4 CHECK (max_dia BETWEEN 1 AND 10),
  actualizado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Un envío por usuario, clave (p. ej. 'comida', 'cierre', 'resumen') y día local: evita duplicados del cron.
CREATE TABLE IF NOT EXISTS recordatorios_envios (
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  fecha      TEXT NOT NULL,
  clave      TEXT NOT NULL,
  canal      TEXT NOT NULL,
  creado_en  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (usuario_id, fecha, clave)
);
