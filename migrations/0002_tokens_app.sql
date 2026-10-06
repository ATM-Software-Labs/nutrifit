-- NutriFit · 0002 — tokens Bearer de la app Android (Capacitor).
-- El token va firmado (HMAC, propósito "app") y además se registra aquí por
-- SHA-256 de su jti: así se puede REVOCAR (cerrar sesión, robo del móvil)
-- aunque sea de larga duración. Nunca se guarda el token en claro.
CREATE TABLE IF NOT EXISTS tokens_app (
  jti_hash    TEXT PRIMARY KEY,
  usuario_id  TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  creado_en   INTEGER NOT NULL,
  expira_en   INTEGER NOT NULL,
  revocado_en INTEGER
);
CREATE INDEX IF NOT EXISTS idx_tokens_app_usuario ON tokens_app (usuario_id);
CREATE INDEX IF NOT EXISTS idx_tokens_app_expira ON tokens_app (expira_en);
