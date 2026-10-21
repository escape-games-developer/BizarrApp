-- ─── Pantalla Telepronter ───────────────────────────────────────────────────
--
-- Segunda pantalla del evento: replica lo que muestra /tv para que el
-- participante en el escenario se vea en su telepronter. Es SÓLO un espejo:
-- va muda, no reporta progreso de la canción y no avanza la cola (eso sigue
-- siendo exclusivo de /tv).
--
--   telepronter_espejo        → el Admin invierte la imagen horizontalmente
--                               (los telepronters reflejan la pantalla en un
--                               vidrio, así que hay que mandarla espejada).
--   telepronter_connected_at  → latido propio de la Telepronter, para que el
--                               Admin la muestre activa / inactiva sin mezclarla
--                               con `tv_connected_at`.
--
-- Entra con el mismo link que la TV (code + token de pantalla_event_secrets).

alter table public.pantalla_events
  add column if not exists telepronter_espejo       boolean not null default false,
  add column if not exists telepronter_connected_at timestamptz;

create or replace function public.pantalla_telepronter_report(_event_id uuid, _token text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not public.pantalla__tv_authorized(_event_id, _token) then raise exception 'invalid tv access'; end if;
  update pantalla_events set telepronter_connected_at = now() where id = _event_id;
end $function$;

revoke all on function public.pantalla_telepronter_report(uuid, text) from public;
grant execute on function public.pantalla_telepronter_report(uuid, text) to anon, authenticated;
