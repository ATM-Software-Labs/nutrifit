-- Preferencias de cantidades sincronizadas entre dispositivos:
--   · agua_todas_bebidas: todas las bebidas suman al objetivo de agua.
--   · cantidades_json: última cantidad elegida por producto {id: {cantidad, clave?, t}} (máx. 200).
CREATE TABLE IF NOT EXISTS preferencias_cantidades (
  usuario_id          TEXT PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  agua_todas_bebidas  INTEGER NOT NULL DEFAULT 0 CHECK (agua_todas_bebidas IN (0, 1)),
  agua_t              INTEGER NOT NULL DEFAULT 0,
  cantidades_json     TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(cantidades_json) AND length(cantidades_json) <= 40000),
  actualizado         INTEGER NOT NULL DEFAULT (unixepoch())
);
