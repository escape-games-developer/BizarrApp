-- DJ Democracy → «Reglas de votación»: Sacar Tema (Clásico / Tomatazo) con mínimo de
-- votos reales y mínimo de conectados (columnas en
-- 20261023160000_pantalla_reglas_votacion_columnas). El voto se rechaza con menos
-- conectados que el mínimo, y el corte exige también el mínimo de votos.
-- (`pantalla_get_kick_status` vive en 20261023170100_pantalla_kick_voto_fijo.)

create or replace function public.pantalla_toggle_kick_vote(_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_ev   pantalla_events%rowtype;
  v_votes integer; v_active integer; v_needed integer;
  v_voted boolean := false; v_fired boolean := false;
begin
  if v_user is null then raise exception 'not authenticated'; end if;

  select * into v_ev from pantalla_events where id = _event_id for update;
  if not found                    then raise exception 'event not found'; end if;
  if v_ev.status <> 'live'        then raise exception 'event not live'; end if;
  if not v_ev.kick_enabled        then raise exception 'kick disabled'; end if;
  if v_ev.current_item_id is null then raise exception 'no current song'; end if;

  v_active := public.pantalla__active_count(_event_id);
  if v_active < v_ev.kick_min_connected then raise exception 'kick hidden'; end if;

  perform public.pantalla__ensure_participant(_event_id, v_user);

  delete from pantalla_kick_votes
   where event_id = _event_id and item_id = v_ev.current_item_id and user_id = v_user;

  if not found then
    insert into pantalla_kick_votes (event_id, item_id, user_id)
    values (_event_id, v_ev.current_item_id, v_user);
    v_voted := true;
  end if;

  select count(*)::int into v_votes from pantalla_kick_votes
   where event_id = _event_id and item_id = v_ev.current_item_id;

  if v_voted then
    update pantalla_events
       set kick_votes_current = v_votes,
           kick_impact_seq    = kick_impact_seq + 1,
           kick_last_vote_at  = now()
     where id = _event_id;
  else
    update pantalla_events
       set kick_votes_current = v_votes
     where id = _event_id;
  end if;

  v_needed := greatest(1, ceil(greatest(v_active, 1) * v_ev.kick_threshold_pct / 100.0)::int, v_ev.kick_min_votes);

  if v_voted and v_votes >= v_needed then
    perform public.pantalla__advance(_event_id, null, v_ev.current_item_id, 'kick');
    v_fired := true;
  end if;

  return jsonb_build_object('ok', true, 'voted', v_voted, 'fired', v_fired,
                            'votes', v_votes, 'active', v_active, 'needed', v_needed);
end $function$;
