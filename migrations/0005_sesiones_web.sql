-- NutriFit · 0005 — sesiones web con estado (anti-fijación y revocación).
-- El navegador solo guarda un token HMAC. Aquí queda el SHA-256 del sid y de
-- la familia, nunca el token. Rotar o cerrar sesión invalida el sid anterior.
-- Una reutilización fuera de la gracia revoca toda la familia (sesión robada).
CREATE TABLE IF NOT EXISTS sesiones_web (
  sid_hash         TEXT PRIMARY KEY,                       -- hex(SHA-256(sid))
  familia_hash     TEXT NOT NULL,                          -- hex(SHA-256(familia)); robo → se revoca entera
  usuario_id       TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  email            TEXT NOT NULL,
  creado_en        INTEGER NOT NULL,                       -- epoch s (iat del token vigente)
  expira_en        INTEGER NOT NULL,
  revocado_en      INTEGER,
  reemplazado_por  TEXT,                                   -- sid_hash sucesor, si ya se rotó
  gracia_hasta     INTEGER,                                -- el sid viejo se acepta hasta aquí (peticiones en vuelo)
  visto_en         INTEGER                                 -- primera petición que presentó ESTE sid (null = la cookie no llegó)
);
CREATE INDEX IF NOT EXISTS idx_sesiones_familia ON sesiones_web (familia_hash);
CREATE INDEX IF NOT EXISTS idx_sesiones_expira ON sesiones_web (expira_en);
