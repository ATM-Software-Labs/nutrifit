-- Franjas horarias por comida para los recordatorios (Ajustes → Recordatorios).
-- Sin filas, el servidor usa las franjas por defecto (functions/utils/franjas.ts).
CREATE TABLE IF NOT EXISTS recordatorios_franjas (
  usuario_id   TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  id           TEXT NOT NULL CHECK (length(id) BETWEEN 1 AND 24),
  nombre       TEXT NOT NULL CHECK (length(nombre) BETWEEN 1 AND 30),
  tipo_comida  TEXT NOT NULL CHECK (tipo_comida IN ('desayuno', 'comida', 'cena', 'snack')),
  inicio       TEXT NOT NULL CHECK (inicio GLOB '[0-2][0-9]:[0-5][0-9]'),
  fin          TEXT NOT NULL CHECK (fin GLOB '[0-2][0-9]:[0-5][0-9]' AND fin > inicio),
  aviso_min    INTEGER CHECK (aviso_min IS NULL OR aviso_min BETWEEN 0 AND 1440),
  dias         INTEGER NOT NULL DEFAULT 127 CHECK (dias BETWEEN 1 AND 127),
  activo       INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
  orden        INTEGER NOT NULL DEFAULT 0,
  actualizado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (usuario_id, id)
);
