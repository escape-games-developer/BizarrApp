-- ============================================================================
-- banners: tipo, fecha de publicación y llamado a la acción
--
-- La card de Novedades del cliente pasa al formato imagen 2.4:1 arriba +
-- cuerpo con título, badge de tipo, extracto, botón CTA y fecha. El admin
-- filtra por tipo y por rango de fechas.
--
-- Compatibilidad: las filas existentes quedan como DESTACADO, publicadas en
-- la fecha en que se crearon y sin link (la card no muestra botón).
-- ============================================================================

ALTER TABLE banners ADD COLUMN IF NOT EXISTS type         text DEFAULT 'DESTACADO';
ALTER TABLE banners ADD COLUMN IF NOT EXISTS published_at date DEFAULT CURRENT_DATE;
ALTER TABLE banners ADD COLUMN IF NOT EXISTS cta_mode     text DEFAULT 'VER_DETALLE';
ALTER TABLE banners ADD COLUMN IF NOT EXISTS cta_link     text;

UPDATE banners SET type = 'DESTACADO' WHERE type IS NULL;
UPDATE banners SET published_at = COALESCE(created_at::date, CURRENT_DATE) WHERE published_at IS NULL;
UPDATE banners SET cta_mode = 'VER_DETALLE' WHERE cta_mode IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'banners_type_check') THEN
    ALTER TABLE banners ADD CONSTRAINT banners_type_check
      CHECK (type IN ('PROMO','DESTACADO','EVENTO','PROXIMAMENTE'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'banners_cta_mode_check') THEN
    ALTER TABLE banners ADD CONSTRAINT banners_cta_mode_check
      CHECK (cta_mode IN ('CONSULTAR','VER_DETALLE'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'banners_cta_link_check') THEN
    ALTER TABLE banners ADD CONSTRAINT banners_cta_link_check
      CHECK (cta_link IS NULL OR cta_link ~* '^https?://');
  END IF;
END $$;

ALTER TABLE banners ALTER COLUMN type         SET NOT NULL;
ALTER TABLE banners ALTER COLUMN published_at SET NOT NULL;
ALTER TABLE banners ALTER COLUMN cta_mode     SET NOT NULL;

COMMENT ON COLUMN banners.type         IS 'PROMO | DESTACADO | EVENTO | PROXIMAMENTE. Badge de la card.';
COMMENT ON COLUMN banners.published_at IS 'Fecha que muestra la card. Orden del listado: más nueva primero.';
COMMENT ON COLUMN banners.cta_mode     IS 'Texto del botón: CONSULTAR ("Consultar") | VER_DETALLE ("Ver detalle").';
COMMENT ON COLUMN banners.cta_link     IS 'URL http/https del botón. NULL = la card no muestra botón.';

CREATE INDEX IF NOT EXISTS banners_published_at_idx ON banners (published_at DESC, created_at DESC);
