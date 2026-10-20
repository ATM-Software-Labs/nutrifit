-- Estado de servicios externos opcionales (hoy: Supabase, base secundaria).
-- Lo actualiza la ronda del cron (cada 15 min); /api/health lo lee sin llamar fuera.
CREATE TABLE IF NOT EXISTS estado_servicios (
  servicio      TEXT PRIMARY KEY CHECK (length(servicio) <= 30),
  estado        TEXT NOT NULL CHECK (estado IN ('ok', 'caido', 'pausado', 'sin_config', 'sin_esquema')),
  caido_desde   INTEGER,           -- unixepoch del primer fallo de la racha actual
  ultimo_ok     INTEGER,
  ultimo_error  TEXT CHECK (ultimo_error IS NULL OR length(ultimo_error) <= 300),
  alertado_en   INTEGER,           -- se avisó a la administración de esta caída
  comprobado_en INTEGER NOT NULL DEFAULT (unixepoch())
);
