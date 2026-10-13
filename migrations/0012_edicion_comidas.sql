-- Edición completa de una comida: micronutrientes, cantidad, hora y notas.
ALTER TABLE diario_comidas ADD COLUMN fibra REAL CHECK (fibra IS NULL OR fibra BETWEEN 0 AND 500);
ALTER TABLE diario_comidas ADD COLUMN azucares REAL CHECK (azucares IS NULL OR azucares BETWEEN 0 AND 2000);
ALTER TABLE diario_comidas ADD COLUMN sal REAL CHECK (sal IS NULL OR sal BETWEEN 0 AND 100);
ALTER TABLE diario_comidas ADD COLUMN cantidad REAL CHECK (cantidad IS NULL OR cantidad BETWEEN 0 AND 10000);
ALTER TABLE diario_comidas ADD COLUMN unidad TEXT CHECK (unidad IS NULL OR unidad IN ('g', 'ml', 'unidad', 'racion'));
ALTER TABLE diario_comidas ADD COLUMN hora TEXT CHECK (hora IS NULL OR hora GLOB '[0-2][0-9]:[0-5][0-9]');
ALTER TABLE diario_comidas ADD COLUMN notas TEXT CHECK (notas IS NULL OR length(notas) <= 500);
