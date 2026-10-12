-- Emoji representativo de cada comida, producto y comida frecuente.
-- Las fotos dejan de mostrarse en el diario: se muestra este emoji.
ALTER TABLE diario_comidas ADD COLUMN emoji TEXT CHECK (emoji IS NULL OR length(emoji) <= 16);
ALTER TABLE productos_usuario ADD COLUMN emoji TEXT CHECK (emoji IS NULL OR length(emoji) <= 16);
ALTER TABLE comidas_frecuentes ADD COLUMN emoji TEXT CHECK (emoji IS NULL OR length(emoji) <= 16);
