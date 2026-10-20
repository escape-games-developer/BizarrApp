-- ─── DJ Democracy: datos que muestra la card de canción del Editor ──────────
--
--   category  → categoría de la canción (A–D). Se guarda y se muestra; todavía
--               no la usa la rotación de candidatas (eso es otra etapa).
--   edited    → true cuando el operador corrigió a mano el título o el artista
--               (la card muestra «EDITADO»).
--   duration_seconds → hoy está vacía en toda la playlist. La TV ya informa la
--               duración del tema que suena (pantalla_tv_report): la primera
--               vez que la informa, queda guardada en la canción. Así la
--               columna se completa sola a medida que suenan los temas.

alter table public.pantalla_playlist_items
  add column if not exists category text not null default 'A',
  add column if not exists edited   boolean not null default false;

alter table public.pantalla_playlist_items
  drop constraint if exists pantalla_items_category_ok;
alter table public.pantalla_playlist_items
  add constraint pantalla_items_category_ok check (category in ('A','B','C','D'));

create or replace function public.pantalla_tv_report(_event_id uuid, _token text, _current_time numeric, _duration numeric)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_item uuid;
begin
  if not public.pantalla__tv_authorized(_event_id, _token) then raise exception 'invalid tv access'; end if;
  update pantalla_events set tv_current_time = _current_time, tv_duration = _duration,
    tv_connected_at = now() where id = _event_id
  returning current_item_id into v_item;

  -- Aprende la duración real del video la primera vez que la TV la informa.
  if v_item is not null and _duration > 0 then
    update pantalla_playlist_items set duration_seconds = round(_duration)::int
     where id = v_item and duration_seconds is null;
  end if;
end $function$;
