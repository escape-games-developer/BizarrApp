-- ─── Pantalla/Escenario: latido propio de la TV ─────────────────────────────
--
-- Bug: el Admin mostraba la Pantalla Gigante INACTIVA con la TV funcionando.
-- `tv_connected_at` sólo lo actualizaba pantalla_tv_report, que la TV manda
-- junto con el progreso de la canción del DJ — y ese reporte se corta cuando
-- no hay canción al aire (Follow the Leader, Personal Trainer, Duelo, juegos,
-- placas). Ahora la TV late por su cuenta, como la Telepronter.

create or replace function public.pantalla_tv_latido(_event_id uuid, _token text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not public.pantalla__tv_authorized(_event_id, _token) then raise exception 'invalid tv access'; end if;
  update pantalla_events set tv_connected_at = now() where id = _event_id;
end $function$;

revoke all on function public.pantalla_tv_latido(uuid, text) from public;
grant execute on function public.pantalla_tv_latido(uuid, text) to anon, authenticated;
