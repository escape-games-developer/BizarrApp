-- Rotación por Categorías por FILAS (2/2): `pantalla_refill_candidates` cubre
-- las filas de `category_rotation.rows` con `pantalla__rotacion_filas`
-- (20261023180000) en lugar de los lugares por categoría (`slots`).
-- El resto de la función queda igual.

create or replace function public.pantalla_refill_candidates(_event_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_ev pantalla_events%rowtype; v_have integer; v_need integer;
  v_added integer := 0; v_n integer; v_relegated uuid[];
begin
  select * into v_ev from pantalla_events where id = _event_id;
  if not found then raise exception 'event not found'; end if;

  select array(select id from pantalla_playlist_items
    where event_id = _event_id and is_active_candidate and not locked and not pinned
      and consecutive_last_place_rounds >= v_ev.relegation_rounds_threshold) into v_relegated;

  select v_relegated || array(select id from pantalla_playlist_items
    where event_id = _event_id and is_active_candidate and not locked and not pinned
      and score <= v_ev.reject_score_threshold and not (id = any(v_relegated))) into v_relegated;

  if array_length(v_relegated, 1) > 0 then
    delete from pantalla_votes where item_id = any(v_relegated);
    update pantalla_playlist_items set
      is_active_candidate = false,
      last_status = case when score <= v_ev.reject_score_threshold then 'rejected' else 'idle' end,
      last_status_changed_at = now(), consecutive_last_place_rounds = 0,
      pos_votes = 0, neg_votes = 0, score = 0,
      position = (select coalesce(max(position),0) + 1 from pantalla_playlist_items where event_id = _event_id)
    where id = any(v_relegated);
  end if;

  update pantalla_playlist_items pi set
    is_active_candidate = true, last_status = 'active', last_status_changed_at = now()
  where pi.event_id = _event_id and pi.pinned and pi.enabled and not pi.is_active_candidate
    and pi.id is distinct from v_ev.current_item_id
    and (v_ev.active_set_id is null or exists (
      select 1 from pantalla_set_items si where si.set_id = v_ev.active_set_id and si.item_id = pi.id));

  select count(*) into v_have from pantalla_playlist_items
   where event_id = _event_id and is_active_candidate and id is distinct from v_ev.current_item_id;

  v_need := v_ev.active_candidates_count - v_have;
  if v_need <= 0 then return 0; end if;

  -- Filas de la rotación por categorías, en orden.
  if coalesce((v_ev.category_rotation->>'enabled')::boolean, false) then
    v_added := public.pantalla__rotacion_filas(_event_id, v_need, v_ev.current_item_id,
                 v_ev.active_set_id, v_ev.category_rotation->'rows');
    v_need := v_need - v_added;
  end if;

  if v_need <= 0 then return v_added; end if;

  with elegibles as (
    select pi.id from pantalla_playlist_items pi
     where pi.event_id = _event_id and pi.enabled and not pi.is_active_candidate
       and pi.id is distinct from v_ev.current_item_id
       and coalesce(pi.last_status,'idle') <> 'rejected'
       and (v_ev.active_set_id is null or exists (
         select 1 from pantalla_set_items si where si.set_id = v_ev.active_set_id and si.item_id = pi.id))
     order by (pi.last_status = 'played_recently') asc, pi.times_played asc, pi.position asc, pi.created_at asc
     limit v_need
  )
  update pantalla_playlist_items pi set
    is_active_candidate = true, last_status = 'active', last_status_changed_at = now(),
    consecutive_last_place_rounds = 0, pos_votes = 0, neg_votes = 0, score = 0
  from elegibles e where pi.id = e.id;

  get diagnostics v_n = row_count;
  return v_added + v_n;
end $function$;
