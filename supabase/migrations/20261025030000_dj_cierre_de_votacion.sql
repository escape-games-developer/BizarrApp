-- ─── DJ Democracy: cierre automático de la votación al final de cada canción ─
--
-- Como el DJ Democracy original: en los últimos `vote_close_seconds` segundos
-- de la canción al aire la votación se CIERRA SOLA (se prepara la próxima) y
-- la TV muestra «❄ VOTACIÓN CERRADA — PREPARANDO PRÓXIMA» con la cuenta
-- regresiva. Siempre activo: 15 s de fábrica; 0 = sin cierre.
--
-- Cuánto falta lo sabe la TV, que reporta cada 4 s por dónde va la canción
-- (tv_current_time / tv_duration, ya con el recorte). `tv_reported_at` es
-- cuándo llegó ese reporte — tv_connected_at no sirve: el latido lo mueve sin
-- reportar tiempo —; entre reportes se adelanta el reloj si está sonando. Un
-- reporte anterior a que arrancara la canción actual (current_started_at) no
-- cuenta: es de la canción anterior.
--
-- El servidor rechaza 👍/👎 y súper votos en esa ventana ('voting closed').
-- El botón BLOQUEAR del DJ (voting_frozen) NO es esto: congela el ranking
-- visible y los votos siguen entrando.
--
-- Parte A: columnas, funciones, pantalla_tv_report y pantalla_cast_super_vote.
-- Parte B (SQL Editor: tiene un DELETE): pantalla_cast_vote.

-- ══ PARTE A ═════════════════════════════════════════════════════════════════
alter table public.pantalla_events
  add column if not exists vote_close_seconds integer not null default 15
    check (vote_close_seconds between 0 and 120),
  add column if not exists tv_reported_at timestamptz;

/** Segundos que le quedan a la canción al aire, o null si no se sabe. */
create or replace function public.pantalla__segundos_restantes(_ev pantalla_events)
returns numeric
language sql
stable
set search_path = public
as $$
  select case
    when _ev.current_item_id is null or coalesce(_ev.tv_duration, 0) <= 0 or _ev.tv_reported_at is null then null
    when _ev.current_started_at is not null and _ev.tv_reported_at < _ev.current_started_at then null
    when _ev.tv_reported_at < now() - interval '30 seconds' then null
    else _ev.tv_duration - (_ev.tv_current_time
      + case when coalesce(_ev.is_playing, true) then extract(epoch from now() - _ev.tv_reported_at) else 0 end)
  end;
$$;

/** ¿La votación de la canción al aire ya cerró (últimos vote_close_seconds)? */
create or replace function public.pantalla__votacion_cerrada(_ev pantalla_events)
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(_ev.vote_close_seconds, 0) > 0
     and coalesce(public.pantalla__segundos_restantes(_ev) <= _ev.vote_close_seconds, false);
$$;

create or replace function public.pantalla_tv_report(_event_id uuid, _token text, _current_time numeric, _duration numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_item uuid;
begin
  if not public.pantalla__tv_authorized(_event_id, _token) then raise exception 'invalid tv access'; end if;
  update pantalla_events set tv_current_time = _current_time, tv_duration = _duration,
    tv_connected_at = now(), tv_reported_at = now() where id = _event_id
  returning current_item_id into v_item;

  if v_item is not null and _duration > 0 then
    update pantalla_playlist_items set duration_seconds = round(_duration)::int
     where id = v_item and duration_seconds is null;
  end if;
end $$;

create or replace function public.pantalla_cast_super_vote(_event_id uuid, _item_id uuid, _type text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
DECLARE
  v_user uuid := auth.uid(); v_ev pantalla_events%ROWTYPE; v_part pantalla_participants%ROWTYPE;
  v_enabled boolean; v_weight integer; v_quota integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _type NOT IN ('super_up','super_down') THEN RAISE EXCEPTION 'invalid vote type'; END IF;
  SELECT * INTO v_ev FROM pantalla_events WHERE id = _event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'event not found'; END IF;
  IF v_ev.status <> 'live' THEN RAISE EXCEPTION 'event not live'; END IF;
  IF v_ev.voting_disabled THEN RAISE EXCEPTION 'voting disabled'; END IF;
  IF public.pantalla__votacion_cerrada(v_ev) THEN RAISE EXCEPTION 'voting closed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pantalla_playlist_items
    WHERE id = _item_id AND event_id = _event_id AND enabled AND is_active_candidate
      AND id IS DISTINCT FROM v_ev.current_item_id)
  THEN RAISE EXCEPTION 'song not in active candidates'; END IF;

  PERFORM public.pantalla__ensure_participant(_event_id, v_user);
  SELECT * INTO v_part FROM pantalla_participants
   WHERE event_id = _event_id AND user_id = v_user FOR UPDATE;

  SELECT enabled, value INTO v_enabled, v_weight FROM pantalla_vote_powers
   WHERE event_id = _event_id AND role = v_part.role AND vote_type = _type;
  IF NOT COALESCE(v_enabled, false) THEN RAISE EXCEPTION 'vote_disabled_for_role'; END IF;

  v_quota := v_ev.super_votes_per_user + v_part.extra_super_votes;
  IF v_part.super_votes_used >= v_quota THEN RAISE EXCEPTION 'super already used'; END IF;

  INSERT INTO pantalla_votes (event_id, item_id, user_id, vote_type, weight)
  VALUES (_event_id, _item_id, v_user, _type, v_weight)
  ON CONFLICT (event_id, item_id, user_id, vote_type)
  DO UPDATE SET weight = EXCLUDED.weight, updated_at = now();

  UPDATE pantalla_participants SET super_votes_used = super_votes_used + 1 WHERE id = v_part.id;
  UPDATE pantalla_playlist_items SET hot_until = now() + interval '2 minutes' WHERE id = _item_id;
  PERFORM public.pantalla__recalc(ARRAY[_item_id]);
  RETURN jsonb_build_object('ok', true, 'weight', v_weight,
                            'remaining', v_quota - v_part.super_votes_used - 1);
END $$;

-- ══ PARTE B (SQL Editor) ════════════════════════════════════════════════════
create or replace function public.pantalla_cast_vote(_event_id uuid, _item_id uuid, _type text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
DECLARE
  v_user uuid := auth.uid(); v_ev pantalla_events%ROWTYPE; v_role text;
  v_enabled boolean; v_weight integer; v_touched uuid[];
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _type NOT IN ('up','down') THEN RAISE EXCEPTION 'invalid vote type'; END IF;
  SELECT * INTO v_ev FROM pantalla_events WHERE id = _event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'event not found'; END IF;
  IF v_ev.status <> 'live' THEN RAISE EXCEPTION 'event not live'; END IF;
  IF v_ev.voting_disabled THEN RAISE EXCEPTION 'voting disabled'; END IF;
  IF public.pantalla__votacion_cerrada(v_ev) THEN RAISE EXCEPTION 'voting closed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pantalla_playlist_items
    WHERE id = _item_id AND event_id = _event_id AND enabled AND is_active_candidate
      AND id IS DISTINCT FROM v_ev.current_item_id)
  THEN RAISE EXCEPTION 'song not in active candidates'; END IF;

  v_role := public.pantalla__ensure_participant(_event_id, v_user);
  SELECT enabled, value INTO v_enabled, v_weight FROM pantalla_vote_powers
   WHERE event_id = _event_id AND role = v_role AND vote_type = _type;
  IF NOT COALESCE(v_enabled, false) THEN RAISE EXCEPTION 'vote_disabled_for_role'; END IF;

  v_touched := ARRAY[_item_id];
  DELETE FROM pantalla_votes WHERE event_id = _event_id AND item_id = _item_id
    AND user_id = v_user AND vote_type = public.pantalla__opposite(_type);

  IF v_ev.voting_mode = 'best' THEN
    v_touched := v_touched || ARRAY(SELECT item_id FROM pantalla_votes
      WHERE event_id = _event_id AND user_id = v_user AND vote_type = _type AND item_id <> _item_id);
    DELETE FROM pantalla_votes WHERE event_id = _event_id AND user_id = v_user
      AND vote_type = _type AND item_id <> _item_id;
  END IF;

  INSERT INTO pantalla_votes (event_id, item_id, user_id, vote_type, weight)
  VALUES (_event_id, _item_id, v_user, _type, v_weight)
  ON CONFLICT (event_id, item_id, user_id, vote_type)
  DO UPDATE SET weight = EXCLUDED.weight, updated_at = now();

  PERFORM public.pantalla__recalc(v_touched);
  RETURN jsonb_build_object('ok', true, 'weight', v_weight, 'role', v_role);
END $$;
