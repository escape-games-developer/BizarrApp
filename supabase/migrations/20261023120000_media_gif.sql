-- Biblioteca de imágenes (bucket bizarren-media): también acepta GIF.
--
-- Lo usa la transición entre canciones del DJ (DJ Democracy → Editor →
-- «Transición entre canciones»), que ahora se sube desde la PC además de por
-- URL. El resto de la configuración del bucket (público, 10 MB, policies de
-- escritura para admin_users) no cambia.

update storage.buckets
   set allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
 where id = 'bizarren-media';
