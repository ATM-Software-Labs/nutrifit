-- Centro de notificaciones en la app y canales por tipo de aviso.
CREATE TABLE IF NOT EXISTS notificaciones_app (
  id         TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo       TEXT NOT NULL CHECK (length(tipo) <= 30),
  titulo     TEXT NOT NULL CHECK (length(titulo) <= 120),
  cuerpo     TEXT NOT NULL CHECK (length(cuerpo) <= 400),
  url        TEXT CHECK (url IS NULL OR length(url) <= 200),
  leida      INTEGER NOT NULL DEFAULT 0,
  creado_en  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_notif_usuario ON notificaciones_app (usuario_id, creado_en);
-- {"comidas":{"push":1,"email":0,"app":1}, ...}; NULL = valores por defecto.
ALTER TABLE recordatorios_pref ADD COLUMN canales_json TEXT CHECK (canales_json IS NULL OR json_valid(canales_json));
-- Dispositivos ya vistos al iniciar sesión (huella = SHA-256 de navegador/SO + país): avisa de accesos nuevos.
CREATE TABLE IF NOT EXISTS accesos_conocidos (
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  huella     TEXT NOT NULL,
  descripcion TEXT,
  visto_en   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (usuario_id, huella)
);
