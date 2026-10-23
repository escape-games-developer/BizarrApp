-- Tandas publicitarias: la TV avisa que terminó de emitir un clip.
--
-- /tv entra sin sesión (código + token), así que no puede escribir
-- `pantalla_ad_clips` directo. Esta función valida el token como las demás
-- `tv_*` y suma una emisión a `times_played`, que es lo que ordena la rotación
-- (sale primero el menos emitido) y lo que muestra el Editor («▶ N»).

create or replace function public.tv_tanda_emitida(_event_id uuid, _token text, _clip_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_n integer;
begin
  if not public.pantalla__tv_authorized(_event_id, _token) then
    raise exception 'invalid tv access';
  end if;
  if _clip_id is null then return false; end if;

  update public.pantalla_ad_clips
     set times_played = times_played + 1
   where id = _clip_id and event_id = _event_id;
  get diagnostics v_n = row_count;
  return v_n > 0;
end $function$;

grant execute on function public.tv_tanda_emitida(uuid, text, uuid) to anon, authenticated;
