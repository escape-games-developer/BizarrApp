-- Bucket `tandas-audio` para los MP3 propios de las tandas publicitarias del DJ
-- (la columna `pantalla_ad_clips.audio_path` ya existía, pero no había dónde
-- subirlos). Mismo esquema que `videos-locales`: lectura pública (la TV entra
-- sin sesión) y subir / borrar sólo admin_users.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tandas-audio', 'tandas-audio', true, 20971520, array['audio/mpeg', 'audio/mp3'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists tandas_audio_public_read on storage.objects;
create policy tandas_audio_public_read on storage.objects
  for select using (bucket_id = 'tandas-audio');

drop policy if exists tandas_audio_admin_upload on storage.objects;
create policy tandas_audio_admin_upload on storage.objects
  for insert to authenticated
  with check (bucket_id = 'tandas-audio'
    and exists (select 1 from public.admin_users au where au.user_id = auth.uid()));

drop policy if exists tandas_audio_admin_delete on storage.objects;
create policy tandas_audio_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'tandas-audio'
    and exists (select 1 from public.admin_users au where au.user_id = auth.uid()));
