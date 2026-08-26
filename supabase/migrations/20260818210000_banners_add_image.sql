-- ============================================================================
-- banners: soporte de pieza gráfica 1440x600
-- Cada card de Novedades en la web app del cliente se renderiza como una
-- imagen con relación de aspecto 12:5 (1440x600). El texto (title/body/tag)
-- queda como fallback cuando no hay imagen cargada.
-- ============================================================================

ALTER TABLE banners ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE banners ADD COLUMN IF NOT EXISTS image_alt text;

COMMENT ON COLUMN banners.image_url IS 'URL pública de la pieza 1440x600 (bucket novedades). Si es NULL, la card usa el layout de texto.';
COMMENT ON COLUMN banners.image_alt IS 'Texto alternativo de la imagen. Si es NULL se usa el title.';
