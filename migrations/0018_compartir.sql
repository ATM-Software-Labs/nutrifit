-- «Compartir mi día»: enlaces públicos de solo lectura /d/<token>.
-- datos_json es la instantánea YA filtrada (solo lo que sale en la tarjeta).
-- og_png: vista previa 1200×630 (< 300 KB) validada en el servidor.
CREATE TABLE IF NOT EXISTS dias_compartidos (
  token        TEXT PRIMARY KEY CHECK (length(token) = 22),
  usuario_id   TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  fecha        TEXT NOT NULL CHECK (fecha GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  datos_json   TEXT NOT NULL CHECK (length(datos_json) <= 16000),
  opciones_json TEXT NOT NULL DEFAULT '{}' CHECK (length(opciones_json) <= 500),
  og_png       BLOB CHECK (og_png IS NULL OR length(og_png) <= 307200),
  creado_en    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expira_en    TEXT,
  revocado_en  TEXT,
  visitas      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_dias_compartidos_usuario ON dias_compartidos (usuario_id, creado_en);
