-- Token aleatorio para la baja en un clic de los correos de recordatorio (List-Unsubscribe, RFC 8058).
ALTER TABLE recordatorios_pref ADD COLUMN baja_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_recordatorios_baja ON recordatorios_pref (baja_token);
