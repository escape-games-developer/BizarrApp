-- Fix RLS: lectura pública de videos en cola (status = 'launched')
--
-- Permite que PantallaGigante (cliente anónimo) y los usuarios autenticados
-- lean los video_requests que el admin ya lanzó. Sin esto el <iframe> no
-- recibía las filas y la pantalla no podía reproducir los videos.
--
-- Aplicado originalmente vía dashboard de Supabase (el MCP estaba en modo
-- read-only). Se versiona acá para reproducibilidad. Idempotente.

alter table public.video_requests enable row level security;

drop policy if exists "public_select_launched_videos" on public.video_requests;
create policy "public_select_launched_videos"
  on public.video_requests
  for select
  to anon, authenticated
  using (status = 'launched');
