-- Sacar Tema: staff y DJ no votan.
--
-- `pantalla__active_count` ya los deja afuera del total de activos (la base
-- del porcentaje), pero el voto se aceptaba igual: con 0 invitados activos un
-- voto del staff alcanzaba para cortar el tema. Ahora ambos RPCs del kick lo
-- rechazan con 'kick staff'. El resto de cada función queda igual que en
-- 20261023160050_pantalla_kick_minimos y 20261023170100_pantalla_kick_voto_fijo.

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

  if public.pantalla__ensure_participant(_event_id, v_user) in ('staff', 'dj') then
    raise exception 'kick staff';
  end if;

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

create or replace function public.pantalla_kick_voto_fijo(_event_id uuid, _value integer)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user   uuid := auth.uid();
  v_ev     pantalla_events%rowtype;
  v_active integer;
  v_pos    integer;
  v_neg    integer;
  v_meter  integer;
  v_saved  boolean;
  v_fired  boolean := false;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if _value is null or _value not in (-1, 1) then raise exception 'invalid vote'; end if;

  select * into v_ev from pantalla_events where id = _event_id for update;
  if not found                    then raise exception 'event not found'; end if;
  if v_ev.status <> 'live'        then raise exception 'event not live'; end if;
  if not v_ev.kick_enabled        then raise exception 'kick disabled'; end if;
  if v_ev.kick_style not in ('love_hate', 'guns_roses') then raise exception 'wrong kick mode'; end if;
  if v_ev.current_item_id is null then raise exception 'no current song'; end if;

  v_active := public.pantalla__active_count(_event_id);
  if v_active < v_ev.kick_min_connected then raise exception 'kick hidden'; end if;

  if v_ev.kick_meter->>'item_id' = v_ev.current_item_id::text
     and coalesce((v_ev.kick_meter->>'saved')::boolean, false) then
    raise exception 'song saved';
  end if;

  if public.pantalla__ensure_participant(_event_id, v_user) in ('staff', 'dj') then
    raise exception 'kick staff';
  end if;

  insert into pantalla_kick_votes (event_id, item_id, user_id, value)
  values (_event_id, v_ev.current_item_id, v_user, _value)
  on conflict (event_id, item_id, user_id) do nothing;
  if not found then raise exception 'already voted'; end if;

  select count(*) filter (where value = 1)::int, count(*) filter (where value = -1)::int
    into v_pos, v_neg
    from pantalla_kick_votes
   where event_id = _event_id and item_id = v_ev.current_item_id;

  v_meter := v_pos - v_neg;
  v_saved := v_meter >= v_ev.kick_positive_threshold;

  update pantalla_events
     set kick_meter = jsonb_build_object('item_id', v_ev.current_item_id, 'value', v_meter,
                                         'pos', v_pos, 'neg', v_neg, 'saved', v_saved),
         kick_votes_current = v_neg,
         kick_impact_seq    = kick_impact_seq + case when _value = -1 then 1 else 0 end,
         kick_flower_seq    = kick_flower_seq + case when _value = 1 then 1 else 0 end,
         kick_last_vote_at  = now()
   where id = _event_id;

  if v_meter <= v_ev.kick_negative_threshold then
    perform public.pantalla__advance(_event_id, null, v_ev.current_item_id, 'kick');
    v_fired := true;
  end if;

  return jsonb_build_object('ok', true, 'value', _value, 'pos', v_pos, 'neg', v_neg,
                            'meter', v_meter, 'saved', v_saved, 'fired', v_fired);
end $function$;
