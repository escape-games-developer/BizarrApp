-- ============================================================================
-- Storage: bucket `bizarren-media`
--
-- Público en lectura (la web app de los clientes resuelve las imágenes de las
-- novedades sin autenticarse) y escritura restringida a admin_users.
-- Mismo criterio que el bucket `videos-locales` ya existente, pero endurecido:
-- allí alcanza con estar autenticado, acá se exige ser admin.
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bizarren-media',
  'bizarren-media',
  true,
  10485760,                                            -- 10 MB por archivo
  ARRAY['image/png','image/jpeg','image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Lectura pública: la web app necesita mostrar las imágenes a cualquier cliente.
DROP POLICY IF EXISTS "bizarren_media_public_read" ON storage.objects;
CREATE POLICY "bizarren_media_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'bizarren-media');

-- Subida: sólo administradores autorizados.
DROP POLICY IF EXISTS "bizarren_media_admin_insert" ON storage.objects;
CREATE POLICY "bizarren_media_admin_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'bizarren-media'
    AND EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "bizarren_media_admin_update" ON storage.objects;
CREATE POLICY "bizarren_media_admin_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'bizarren-media'
    AND EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "bizarren_media_admin_delete" ON storage.objects;
CREATE POLICY "bizarren_media_admin_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'bizarren-media'
    AND EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );
