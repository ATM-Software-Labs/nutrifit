-- Líquidos: unidad (g/ml) ya existe en diario_comidas (0012). Se añaden el
-- contenido del envase, el tamaño de porción y el código de barras, para poder
-- ofrecer «envase entero», «½ envase» o «una porción» al editar la comida.
-- Macros de un líquido: por 100 ml (1 ml ≈ 1 g solo para sumas internas).
ALTER TABLE diario_comidas ADD COLUMN envase REAL CHECK (envase IS NULL OR envase BETWEEN 1 AND 10000);
ALTER TABLE diario_comidas ADD COLUMN porcion REAL CHECK (porcion IS NULL OR porcion BETWEEN 1 AND 2000);
ALTER TABLE diario_comidas ADD COLUMN codigo_barras TEXT CHECK (codigo_barras IS NULL OR (codigo_barras GLOB '[0-9]*' AND length(codigo_barras) BETWEEN 8 AND 14));
