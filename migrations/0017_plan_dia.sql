-- Día de entreno / descanso (Etapa 2). Solo tablas nuevas: sin tocar datos existentes.
-- Sin fila en plan_dia el usuario sigue exactamente igual que antes (metas de usuarios).
CREATE TABLE IF NOT EXISTS plan_dia (
  usuario_id       TEXT PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  -- Bits L=1, M=2, X=4, J=8, V=16, S=32, D=64 → días de entreno automáticos.
  horario_entreno  INTEGER NOT NULL DEFAULT 0 CHECK (horario_entreno BETWEEN 0 AND 127),
  auto             INTEGER NOT NULL DEFAULT 1 CHECK (auto IN (0, 1)),
  entreno_kcal     INTEGER NOT NULL DEFAULT 0 CHECK (entreno_kcal BETWEEN -1500 AND 1500),
  entreno_prot     INTEGER NOT NULL DEFAULT 0 CHECK (entreno_prot BETWEEN -200 AND 200),
  entreno_carbs    INTEGER NOT NULL DEFAULT 0 CHECK (entreno_carbs BETWEEN -400 AND 400),
  entreno_grasas   INTEGER NOT NULL DEFAULT 0 CHECK (entreno_grasas BETWEEN -150 AND 150),
  descanso_kcal    INTEGER NOT NULL DEFAULT 0 CHECK (descanso_kcal BETWEEN -1500 AND 1500),
  descanso_prot    INTEGER NOT NULL DEFAULT 0 CHECK (descanso_prot BETWEEN -200 AND 200),
  descanso_carbs   INTEGER NOT NULL DEFAULT 0 CHECK (descanso_carbs BETWEEN -400 AND 400),
  descanso_grasas  INTEGER NOT NULL DEFAULT 0 CHECK (descanso_grasas BETWEEN -150 AND 150),
  nombres_json     TEXT CHECK (nombres_json IS NULL OR length(nombres_json) <= 400),
  porcion_g        INTEGER CHECK (porcion_g IS NULL OR porcion_g BETWEEN 1 AND 2000),
  actualizado_en   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Marca manual de un día concreto (gana al horario).
CREATE TABLE IF NOT EXISTS tipo_dia (
  usuario_id  TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  fecha       TEXT NOT NULL CHECK (fecha GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  tipo        TEXT NOT NULL CHECK (tipo IN ('entreno', 'descanso')),
  PRIMARY KEY (usuario_id, fecha)
);
