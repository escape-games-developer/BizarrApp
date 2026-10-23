-- Amor y Odio / Guns & Roses: el voto único del invitado (ver
-- 20261023170000_pantalla_kick_amor_odio_columnas).
--
-- `pantalla_kick_voto_fijo(evento, ±1)`: un voto por invitado y por tema, que
-- no se cambia ni se quita. Recalcula el medidor (positivos − negativos),
-- lo deja en `pantalla_events.kick_meter` para la TV y suma la secuencia de la
-- animación (flores en `kick_flower_seq`; tomates / balas en `kick_impact_seq`).
-- Al llegar al umbral negativo corta el tema (`pantalla__advance`, que además
-- borra los votos del tema saliente); al llegar al positivo lo deja a salvo.
--
-- `pantalla_get_kick_status` suma lo que el celular necesita para estos modos:
-- umbrales, medidor, si el tema está a salvo, el voto propio y los botones.

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

  perform public.pantalla__ensure_participant(_event_id, v_user);

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

grant execute on function public.pantalla_kick_voto_fijo(uuid, integer) to anon, authenticated;

create or replace function public.pantalla_get_kick_status(_event_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_ev     pantalla_events%rowtype;
  v_votes  integer;
  v_active integer;
  v_needed integer;
  v_voted  boolean;
  v_mio    smallint;
  v_meter  jsonb;
begin
  select * into v_ev from pantalla_events where id = _event_id;
  if not found then return jsonb_build_object('enabled', false); end if;

  select count(*)::int into v_votes from pantalla_kick_votes
   where event_id = _event_id and item_id = v_ev.current_item_id;

  v_active := public.pantalla__active_count(_event_id);
  v_needed := greatest(1, ceil(v_active * v_ev.kick_threshold_pct / 100.0)::int, v_ev.kick_min_votes);

  select value into v_mio from pantalla_kick_votes
   where event_id = _event_id and item_id = v_ev.current_item_id
     and user_id = auth.uid();
  v_voted := v_mio is not null;

  -- El medidor guardado es del tema en curso; si es de otro, arranca en cero.
  v_meter := case when v_ev.kick_meter->>'item_id' = v_ev.current_item_id::text
                  then v_ev.kick_meter
                  else jsonb_build_object('value', 0, 'pos', 0, 'neg', 0, 'saved', false) end;

  return jsonb_build_object(
    'enabled',            v_ev.kick_enabled,
    'visible',            v_active >= v_ev.kick_min_connected,
    'item_id',            v_ev.current_item_id,
    'votes',              v_votes,
    'active',             v_active,
    'needed',             v_needed,
    'threshold_pct',      v_ev.kick_threshold_pct,
    'min_votes',          v_ev.kick_min_votes,
    'min_connected',      v_ev.kick_min_connected,
    'voted',              coalesce(v_voted, false),
    'my_vote',            v_mio,
    'button_text',        v_ev.kick_button_text,
    'style',              coalesce(v_ev.kick_style, 'classic'),
    'impact_seq',         v_ev.kick_impact_seq,
    'kick_votes_current', v_ev.kick_votes_current,
    'progress',           least(1.0, v_votes::numeric / greatest(v_needed, 1)),
    'positive_threshold', v_ev.kick_positive_threshold,
    'negative_threshold', v_ev.kick_negative_threshold,
    'meter',              coalesce((v_meter->>'value')::int, 0),
    'pos',                coalesce((v_meter->>'pos')::int, 0),
    'neg',                coalesce((v_meter->>'neg')::int, 0),
    'saved',              coalesce((v_meter->>'saved')::boolean, false),
    'flower_text',        v_ev.kick_flower_text,
    'shoot_text',         v_ev.kick_shoot_text,
    'assets',             jsonb_build_object(
                            'flying',      v_ev.kick_tomato_flying_url,
                            'exploded',    v_ev.kick_tomato_exploded_url,
                            'splat',       v_ev.kick_tomato_splat_url,
                            'flower_icon', v_ev.kick_flower_icon_url,
                            'shoot_icon',  v_ev.kick_shoot_icon_url)
  );
end $function$;
