-- Biblioteca de videos de los juegos de Escenario (Follow the Leader / PT).
--
-- Reemplaza, para estos juegos, el catálogo de Playlists YouTube por
-- categoría: el operador carga los desafíos desde el propio panel del juego.
--   escenario_playlists → playlists con nombre, por juego
--   escenario_videos    → links de YouTube (Link | Nombre) o archivos subidos
--                         al bucket `videos-locales` (MP4/WebM)
-- Un video pertenece a una playlist o a ninguna ("Sin playlist"). Borrar una
-- playlist no borra sus videos: quedan sin playlist.
--
-- Sólo el staff lee y escribe (is_admin()). La TV no lee estas tablas: el
-- video elegido viaja en game_state.escenario_video.

create table if not exists public.escenario_playlists (
  id          uuid primary key default gen_random_uuid(),
  juego       text not null check (juego in ('ftl','pt')),
  nombre      text not null check (length(btrim(nombre)) between 1 and 80),
  created_at  timestamptz not null default now()
);

create table if not exists public.escenario_videos (
  id            uuid primary key default gen_random_uuid(),
  juego         text not null check (juego in ('ftl','pt')),
  playlist_id   uuid references public.escenario_playlists(id) on delete set null,
  nombre        text not null check (length(btrim(nombre)) between 1 and 120),
  fuente        text not null check (fuente in ('youtube','archivo')),
  yt_id         text,
  url           text,
  storage_path  text,
  created_at    timestamptz not null default now(),
  constraint escenario_videos_fuente_ok check (
    (fuente = 'youtube' and yt_id is not null) or
    (fuente = 'archivo' and url is not null)
  )
);

create index if not exists escenario_playlists_juego_idx on public.escenario_playlists (juego, created_at);
create index if not exists escenario_videos_juego_idx    on public.escenario_videos (juego, created_at);
create index if not exists escenario_videos_playlist_idx on public.escenario_videos (playlist_id);

alter table public.escenario_playlists enable row level security;
alter table public.escenario_videos    enable row level security;

drop policy if exists escenario_playlists_staff on public.escenario_playlists;
create policy escenario_playlists_staff on public.escenario_playlists
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists escenario_videos_staff on public.escenario_videos;
create policy escenario_videos_staff on public.escenario_videos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Dos PCs de operación ven la misma biblioteca sin recargar.
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'escenario_playlists') then
    alter publication supabase_realtime add table public.escenario_playlists;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'escenario_videos') then
    alter publication supabase_realtime add table public.escenario_videos;
  end if;
end $$;
