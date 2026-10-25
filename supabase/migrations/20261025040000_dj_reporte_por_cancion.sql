-- ─── DJ Democracy: el reporte de la TV dice de qué canción es ───────────────
--
-- Durante el cruce entre canciones la TV sigue reportando el tiempo del tema
-- que se va unos segundos, cuando la base ya tiene el siguiente como actual:
-- el cierre de la votación (migración 20261025030000) se quedaba ~4 s de más
-- en la canción nueva. Ahora la TV manda el id de la canción que reporta
-- (`_item_id`) y un reporte de otra canción no cuenta.
--
-- pantalla_tv_report de 4 argumentos queda igual (TVs con el código anterior):
-- sin `tv_reported_item`, se sigue usando current_started_at como antes.

alter table public.pantalla_events add column if not exists tv_reported_item uuid;

create or replace function public.pantalla_tv_report(_event_id uuid, _token text, _current_time numeric, _duration numeric, _item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_item uuid;
begin
  if not public.pantalla__tv_authorized(_event_id, _token) then raise exception 'invalid tv access'; end if;
  update pantalla_events set tv_current_time = _current_time, tv_duration = _duration,
    tv_connected_at = now(), tv_reported_at = now(), tv_reported_item = _item_id where id = _event_id
  returning current_item_id into v_item;

  if v_item is not null and v_item = _item_id and _duration > 0 then
    update pantalla_playlist_items set duration_seconds = round(_duration)::int
     where id = v_item and duration_seconds is null;
  end if;
end $$;
grant execute on function public.pantalla_tv_report(uuid, text, numeric, numeric, uuid) to anon, authenticated;

create or replace function public.pantalla__segundos_restantes(_ev pantalla_events)
returns numeric
language sql
stable
set search_path = public
as $$
  select case
    when _ev.current_item_id is null or coalesce(_ev.tv_duration, 0) <= 0 or _ev.tv_reported_at is null then null
    when _ev.tv_reported_item is not null and _ev.tv_reported_item <> _ev.current_item_id then null
    when _ev.current_started_at is not null and _ev.tv_reported_at < _ev.current_started_at then null
    when _ev.tv_reported_at < now() - interval '30 seconds' then null
    else _ev.tv_duration - (_ev.tv_current_time
      + case when coalesce(_ev.is_playing, true) then extract(epoch from now() - _ev.tv_reported_at) else 0 end)
  end;
$$;
