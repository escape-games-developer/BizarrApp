-- ============================================================================
-- media_assets — Biblioteca de imágenes administrable
--
-- Reemplaza progresivamente los emojis / imágenes hardcodeadas de las
-- Novedades por recursos subidos desde el navegador por el staff.
-- Los archivos viven en el bucket público `bizarren-media`; esta tabla guarda
-- la metadata y es la que se consulta desde el modal de biblioteca.
-- ============================================================================

CREATE TABLE IF NOT EXISTS media_assets (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text        NOT NULL,
  file_url     text        NOT NULL,          -- URL pública del archivo original
  storage_path text        NOT NULL UNIQUE,   -- path dentro del bucket bizarren-media
  thumb_url    text,                          -- URL pública del thumbnail (webp ~320px)
  thumb_path   text,                          -- path del thumbnail dentro del bucket
  category     text,                          -- agrupación libre: "personajes", "logos", …
  mime_type    text,
  width        integer,
  height       integer,
  size_bytes   integer,
  created_by   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz DEFAULT now()
);

COMMENT ON TABLE  media_assets            IS 'Biblioteca de imágenes seleccionables desde el admin (bucket bizarren-media).';
COMMENT ON COLUMN media_assets.storage_path IS 'Path relativo dentro del bucket bizarren-media. Único: identifica el archivo.';
COMMENT ON COLUMN media_assets.thumb_url  IS 'Miniatura generada en el navegador al subir. Si es NULL se usa file_url.';

CREATE INDEX IF NOT EXISTS media_assets_category_idx   ON media_assets (category);
CREATE INDEX IF NOT EXISTS media_assets_created_at_idx ON media_assets (created_at DESC);

ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;

-- La web app pública sólo necesita leer (para resolver la imagen de una novedad).
DROP POLICY IF EXISTS "media_assets: todos leen" ON media_assets;
CREATE POLICY "media_assets: todos leen"
  ON media_assets FOR SELECT
  USING (true);

-- Alta / baja / edición de metadata: sólo administradores autorizados.
DROP POLICY IF EXISTS "media_assets: admin gestiona" ON media_assets;
CREATE POLICY "media_assets: admin gestiona"
  ON media_assets FOR ALL
  USING      (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));
