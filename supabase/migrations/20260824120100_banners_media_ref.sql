-- ============================================================================
-- banners: referencia a la biblioteca de imágenes + encuadre dentro de la card
--
-- Compatibilidad: las novedades viejas siguen funcionando tal cual.
--   1. image_url        → pieza gráfica completa 1440x600 (layout actual)
--   2. image_asset_id   → imagen de la biblioteca, superpuesta sobre el layout
--                         de texto y encuadrada con position/scale/x/y
--   3. sin ninguna      → emoji + texto (comportamiento histórico)
-- ============================================================================

-- Columnas de la pieza 1440x600 (migración 20260818210000, nunca aplicada en
-- el proyecto remoto — se repite acá de forma idempotente).
ALTER TABLE banners ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE banners ADD COLUMN IF NOT EXISTS image_alt text;

COMMENT ON COLUMN banners.image_url IS 'URL pública de la pieza 1440x600. Si es NULL, la card usa el layout de texto.';
COMMENT ON COLUMN banners.image_alt IS 'Texto alternativo de la imagen. Si es NULL se usa el title.';

-- Referencia a la biblioteca. ON DELETE SET NULL: borrar un recurso no rompe
-- la novedad, sólo la deja sin imagen (vuelve al emoji).
ALTER TABLE banners ADD COLUMN IF NOT EXISTS image_asset_id uuid
  REFERENCES media_assets(id) ON DELETE SET NULL;

-- Encuadre dentro de la card.
ALTER TABLE banners ADD COLUMN IF NOT EXISTS image_position text    DEFAULT 'right';
ALTER TABLE banners ADD COLUMN IF NOT EXISTS image_scale    integer DEFAULT 100;
ALTER TABLE banners ADD COLUMN IF NOT EXISTS image_x        integer DEFAULT 0;
ALTER TABLE banners ADD COLUMN IF NOT EXISTS image_y        integer DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'banners_image_position_check') THEN
    ALTER TABLE banners ADD CONSTRAINT banners_image_position_check
      CHECK (image_position IS NULL OR image_position IN ('left','right','background'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'banners_image_scale_check') THEN
    ALTER TABLE banners ADD CONSTRAINT banners_image_scale_check
      CHECK (image_scale IS NULL OR image_scale BETWEEN 50 AND 180);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'banners_image_offset_check') THEN
    ALTER TABLE banners ADD CONSTRAINT banners_image_offset_check
      CHECK ((image_x IS NULL OR image_x BETWEEN -100 AND 100)
         AND (image_y IS NULL OR image_y BETWEEN -100 AND 100));
  END IF;
END $$;

COMMENT ON COLUMN banners.image_asset_id IS 'Recurso de media_assets a mostrar en la card. NULL = usar emoji/icono anterior.';
COMMENT ON COLUMN banners.image_position IS 'left | right | background. Default right.';
COMMENT ON COLUMN banners.image_scale    IS 'Escala en porcentaje, 50 a 180. Default 100.';
COMMENT ON COLUMN banners.image_x        IS 'Desplazamiento horizontal, -100 a 100 (% del ancho de la imagen).';
COMMENT ON COLUMN banners.image_y        IS 'Desplazamiento vertical, -100 a 100 (% del alto de la imagen).';

CREATE INDEX IF NOT EXISTS banners_image_asset_id_idx ON banners (image_asset_id);
