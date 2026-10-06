-- Migration number: 0003 	 NutriFit · código de 6 cifras y login por QR
-- Aplicar:  npm run db:migrate:local   |   npm run db:migrate:remote

-- ---------------------------------------------------------- codigos_login
-- Código de 6 cifras que acompaña al magic link en el mismo email.
-- Solo se guarda HMAC-SHA256(AUTH_SECRET, id:email:código): una filtración de
-- la BD no revela el código. Un solo uso, 15 min, máx. 5 intentos fallidos
-- (al 5.º se invalida). Pedir un código nuevo invalida los anteriores del email.
CREATE TABLE IF NOT EXISTS codigos_login (
  id           TEXT PRIMARY KEY,                           -- aleatorio (base64url, 16 bytes)
  email        TEXT NOT NULL COLLATE NOCASE,
  codigo_hash  TEXT NOT NULL,                              -- hex(HMAC)
  expira_en    INTEGER NOT NULL,                           -- epoch s
  intentos     INTEGER NOT NULL DEFAULT 0,
  usado_en     INTEGER,                                    -- epoch s; también al invalidarse
  creado_en    INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_codigos_login_email ON codigos_login (email, expira_en);

-- ------------------------------------------------------- emparejamientos_qr
-- Login en el PC escaneando un QR con el móvil (ya con sesión).
--   · id: 256 bits aleatorios; en D1 solo SHA-256(id).
--   · secreto: lo genera el navegador del PC y NUNCA sale de él salvo al
--     consultar el estado; aquí solo SHA-256(secreto) → el QR por sí solo no
--     sirve para robar la sesión.
--   · 2 minutos para aprobar; la sesión se entrega UNA vez (estado 'consumido').
CREATE TABLE IF NOT EXISTS emparejamientos_qr (
  id_hash       TEXT PRIMARY KEY,
  secreto_hash  TEXT NOT NULL,
  codigo        TEXT NOT NULL,                             -- código corto para comparar en ambas pantallas
  estado        TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobado', 'rechazado', 'consumido')),
  dispositivo   TEXT,                                      -- «Chrome · Windows» (aprox., del User-Agent)
  ubicacion     TEXT,                                      -- «Madrid, ES» (aprox., de Cloudflare)
  usuario_id    TEXT REFERENCES usuarios(id) ON DELETE CASCADE,
  expira_en     INTEGER NOT NULL,
  aprobado_en   INTEGER,
  creado_en     INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_emparejamientos_expira ON emparejamientos_qr (expira_en);
