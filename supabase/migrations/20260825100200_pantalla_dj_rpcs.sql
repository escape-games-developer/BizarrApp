-- ============================================================================
-- PANTALLA/ESCENARIO — Lógica de negocio en Postgres
--
-- Todo lo sensible vive acá, en funciones SECURITY DEFINER. El frontend nunca
-- hace `UPDATE pantalla_playlist_items SET score = ...`: pide `cast_vote` y el
-- servidor decide. Mismo criterio que DJ Democracy, con los agujeros cerrados.
-- ============================================================================


-- ── Helpers internos ────────────────────────────────────────────────────────

-- Recalcula los agregados de un conjunto de temas desde la tabla de votos.
-- Fuente de verdad = pantalla_votes; los contadores son sólo una caché.
CREATE OR REPLACE FUNCTION public.pantalla__recalc(_item_ids uuid[])
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE pantalla_playlist_items pi SET
    pos_votes = agg.pos,
    neg_votes = agg.neg,
    score     = agg.pos - agg.neg
  FROM (
    SELECT i.id,
      COALESCE((SELECT SUM(v.weight) FROM pantalla_votes v
                WHERE v.item_id = i.id AND v.vote_type IN ('up','super_up')), 0)::int   AS pos,
      COALESCE((SELECT SUM(v.weight) FROM pantalla_votes v
                WHERE v.item_id = i.id AND v.vote_type IN ('down','super_down')), 0)::int AS neg
    FROM pantalla_playlist_items i
    WHERE i.id = ANY(_item_ids)
  ) agg
  WHERE pi.id = agg.id;
$$;

-- Voto contrario del mismo par.
CREATE OR REPLACE FUNCTION public.pantalla__opposite(_type text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _type
    WHEN 'up'         THEN 'down'
    WHEN 'down'       THEN 'up'
    WHEN 'super_up'   THEN 'super_down'
    WHEN 'super_down' THEN 'super_up'
  END;
$$;

-- Invitados considerados "activos" para el cálculo del kick.
-- Staff no cuenta, igual que en el sistema original.
CREATE OR REPLACE FUNCTION public.pantalla__active_count(_event_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::int
  FROM pantalla_participants p
  JOIN pantalla_events e ON e.id = p.event_id
  WHERE p.event_id = _event_id
    AND p.role <> 'staff'
    AND p.last_seen_at > now() - make_interval(mins => e.kick_activity_minutes);
$$;

-- Asegura que el usuario esté anotado en el evento. Devuelve su rol.
-- Siempre 'guest' al entrar: los roles especiales sólo los da un admin.
CREATE OR REPLACE FUNCTION public.pantalla__ensure_participant(_event_id uuid, _user_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role text;
BEGIN
  INSERT INTO pantalla_participants (event_id, user_id)
  VALUES (_event_id, _user_id)
  ON CONFLICT (event_id, user_id) DO UPDATE SET last_seen_at = now()
  RETURNING role INTO v_role;
  RETURN v_role;
END $$;


-- ── Presencia ───────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.pantalla_join_event(_event_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_role text; v_status text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT status INTO v_status FROM pantalla_events WHERE id = _event_id;
  IF v_status IS NULL THEN RAISE EXCEPTION 'event not found'; END IF;
  IF v_status <> 'live' THEN RAISE EXCEPTION 'event not live'; END IF;

  v_role := public.pantalla__ensure_participant(_event_id, v_user);
  RETURN jsonb_build_object('ok', true, 'role', v_role, 'user_id', v_user);
END $$;

CREATE OR REPLACE FUNCTION public.pantalla_heartbeat(_event_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  UPDATE pantalla_participants SET last_seen_at = now()
   WHERE event_id = _event_id AND user_id = auth.uid();
END $$;


-- ── Poderes de voto ─────────────────────────────────────────────────────────
-- Matriz por defecto tomada de la configuración observada en el evento de
-- referencia 7F2B0C (auditoría V2, sección J).
CREATE OR REPLACE FUNCTION public.pantalla_reset_vote_powers(_event_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.pantalla_can_manage(_event_id) THEN RAISE EXCEPTION 'not authorized'; END IF;

  DELETE FROM pantalla_vote_powers WHERE event_id = _event_id;
  INSERT INTO pantalla_vote_powers (event_id, role, vote_type, enabled, value) VALUES
    (_event_id,'guest','up',        true, 1),
    (_event_id,'guest','down',      true, 1),
    (_event_id,'guest','super_up',  true, 5),
    (_event_id,'guest','super_down',false,5),
    (_event_id,'vip','up',          true, 2),
    (_event_id,'vip','down',        true, 2),
    (_event_id,'vip','super_up',    true, 5),
    (_event_id,'vip','super_down',  false,5),
    (_event_id,'birthday','up',     true, 3),
    (_event_id,'birthday','down',   true, 2),
    (_event_id,'birthday','super_up',true,5),
    (_event_id,'birthday','super_down',false,5),
    -- Staff vota pero no mueve el ranking (peso 0), igual que el original.
    (_event_id,'staff','up',        true, 0),
    (_event_id,'staff','down',      true, 0),
    (_event_id,'staff','super_up',  true, 0),
    (_event_id,'staff','super_down',false,0);
END $$;


-- ── Votación ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.pantalla_cast_vote(_event_id uuid, _item_id uuid, _type text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_ev   pantalla_events%ROWTYPE;
  v_role text;
  v_enabled boolean;
  v_weight  integer;
  v_touched uuid[];
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _type NOT IN ('up','down') THEN RAISE EXCEPTION 'invalid vote type'; END IF;

  SELECT * INTO v_ev FROM pantalla_events WHERE id = _event_id;
  IF NOT FOUND                THEN RAISE EXCEPTION 'event not found'; END IF;
  IF v_ev.status <> 'live'    THEN RAISE EXCEPTION 'event not live'; END IF;
  IF v_ev.voting_disabled     THEN RAISE EXCEPTION 'voting disabled'; END IF;

  -- Sólo se vota dentro de la ventana de candidatos, nunca sobre la playlist
  -- entera ni sobre el tema que ya está sonando.
  IF NOT EXISTS (
    SELECT 1 FROM pantalla_playlist_items
    WHERE id = _item_id AND event_id = _event_id
      AND enabled AND is_active_candidate
      AND id IS DISTINCT FROM v_ev.current_item_id
  ) THEN RAISE EXCEPTION 'song not in active candidates'; END IF;

  v_role := public.pantalla__ensure_participant(_event_id, v_user);

  SELECT enabled, value INTO v_enabled, v_weight
    FROM pantalla_vote_powers
   WHERE event_id = _event_id AND role = v_role AND vote_type = _type;

  IF NOT COALESCE(v_enabled, false) THEN RAISE EXCEPTION 'vote_disabled_for_role'; END IF;

  v_touched := ARRAY[_item_id];

  -- Nadie puede sostener 👍 y 👎 sobre el mismo tema.
  DELETE FROM pantalla_votes
   WHERE event_id = _event_id AND item_id = _item_id AND user_id = v_user
     AND vote_type = public.pantalla__opposite(_type);

  -- Modo "best": el voto normal es único por evento, así que votar otro tema
  -- mueve el voto en lugar de sumar uno nuevo. Modo "rank": uno por tema.
  IF v_ev.voting_mode = 'best' THEN
    v_touched := v_touched || ARRAY(
      SELECT item_id FROM pantalla_votes
       WHERE event_id = _event_id AND user_id = v_user
         AND vote_type = _type AND item_id <> _item_id);
    DELETE FROM pantalla_votes
     WHERE event_id = _event_id AND user_id = v_user
       AND vote_type = _type AND item_id <> _item_id;
  END IF;

  INSERT INTO pantalla_votes (event_id, item_id, user_id, vote_type, weight)
  VALUES (_event_id, _item_id, v_user, _type, v_weight)
  ON CONFLICT (event_id, item_id, user_id, vote_type)
  DO UPDATE SET weight = EXCLUDED.weight, updated_at = now();

  PERFORM public.pantalla__recalc(v_touched);
  RETURN jsonb_build_object('ok', true, 'weight', v_weight, 'role', v_role);
END $$;


CREATE OR REPLACE FUNCTION public.pantalla_clear_vote(_event_id uuid, _item_id uuid, _type text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  DELETE FROM pantalla_votes
   WHERE event_id = _event_id AND item_id = _item_id
     AND user_id = v_user AND vote_type = _type;

  PERFORM public.pantalla__recalc(ARRAY[_item_id]);
  RETURN jsonb_build_object('ok', true);
END $$;


CREATE OR REPLACE FUNCTION public.pantalla_cast_super_vote(_event_id uuid, _item_id uuid, _type text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_ev   pantalla_events%ROWTYPE;
  v_part pantalla_participants%ROWTYPE;
  v_enabled boolean; v_weight integer; v_quota integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _type NOT IN ('super_up','super_down') THEN RAISE EXCEPTION 'invalid vote type'; END IF;

  SELECT * INTO v_ev FROM pantalla_events WHERE id = _event_id;
  IF NOT FOUND            THEN RAISE EXCEPTION 'event not found'; END IF;
  IF v_ev.status <> 'live' THEN RAISE EXCEPTION 'event not live'; END IF;
  IF v_ev.voting_disabled THEN RAISE EXCEPTION 'voting disabled'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pantalla_playlist_items
    WHERE id = _item_id AND event_id = _event_id
      AND enabled AND is_active_candidate
      AND id IS DISTINCT FROM v_ev.current_item_id
  ) THEN RAISE EXCEPTION 'song not in active candidates'; END IF;

  PERFORM public.pantalla__ensure_participant(_event_id, v_user);
  SELECT * INTO v_part FROM pantalla_participants
   WHERE event_id = _event_id AND user_id = v_user FOR UPDATE;

  SELECT enabled, value INTO v_enabled, v_weight
    FROM pantalla_vote_powers
   WHERE event_id = _event_id AND role = v_part.role AND vote_type = _type;
  IF NOT COALESCE(v_enabled, false) THEN RAISE EXCEPTION 'vote_disabled_for_role'; END IF;

  -- El cupo se lleva server-side. No hay flag del frontend que valga.
  v_quota := v_ev.super_votes_per_user + v_part.extra_super_votes;
  IF v_part.super_votes_used >= v_quota THEN RAISE EXCEPTION 'super already used'; END IF;

  INSERT INTO pantalla_votes (event_id, item_id, user_id, vote_type, weight)
  VALUES (_event_id, _item_id, v_user, _type, v_weight)
  ON CONFLICT (event_id, item_id, user_id, vote_type)
  DO UPDATE SET weight = EXCLUDED.weight, updated_at = now();

  UPDATE pantalla_participants SET super_votes_used = super_votes_used + 1
   WHERE id = v_part.id;

  -- Boost visual temporal, como el `hot_until` del original.
  UPDATE pantalla_playlist_items SET hot_until = now() + interval '2 minutes'
   WHERE id = _item_id;

  PERFORM public.pantalla__recalc(ARRAY[_item_id]);
  RETURN jsonb_build_object('ok', true, 'weight', v_weight,
                            'remaining', v_quota - v_part.super_votes_used - 1);
END $$;


-- ── Ventana de candidatos ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.pantalla_refill_candidates(_event_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ev    pantalla_events%ROWTYPE;
  v_have  integer;
  v_need  integer;
  v_added integer := 0;
  v_relegated uuid[];
BEGIN
  SELECT * INTO v_ev FROM pantalla_events WHERE id = _event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'event not found'; END IF;

  -- 1. Relegación: los que llevan N rondas últimos salen de la ventana.
  --    `locked` y `pinned` son inmunes.
  SELECT ARRAY(
    SELECT id FROM pantalla_playlist_items
     WHERE event_id = _event_id AND is_active_candidate
       AND NOT locked AND NOT pinned
       AND consecutive_last_place_rounds >= v_ev.relegation_rounds_threshold
  ) INTO v_relegated;

  -- 2. Rechazo por score: los que caen bajo el umbral también salen.
  SELECT v_relegated || ARRAY(
    SELECT id FROM pantalla_playlist_items
     WHERE event_id = _event_id AND is_active_candidate
       AND NOT locked AND NOT pinned
       AND score <= v_ev.reject_score_threshold
       AND NOT (id = ANY(v_relegated))
  ) INTO v_relegated;

  IF array_length(v_relegated, 1) > 0 THEN
    -- Al salir se limpian los votos: si vuelve más tarde, arranca de cero.
    DELETE FROM pantalla_votes WHERE item_id = ANY(v_relegated);
    UPDATE pantalla_playlist_items SET
      is_active_candidate = false,
      last_status = CASE WHEN score <= v_ev.reject_score_threshold THEN 'rejected' ELSE 'idle' END,
      last_status_changed_at = now(),
      consecutive_last_place_rounds = 0,
      pos_votes = 0, neg_votes = 0, score = 0,
      -- Al fondo de la playlist general.
      position = (SELECT COALESCE(MAX(position), 0) + 1 FROM pantalla_playlist_items WHERE event_id = _event_id)
    WHERE id = ANY(v_relegated);
  END IF;

  -- 3. Los fijados entran siempre.
  UPDATE pantalla_playlist_items SET
    is_active_candidate = true, last_status = 'active', last_status_changed_at = now()
  WHERE event_id = _event_id AND pinned AND enabled AND NOT is_active_candidate
    AND id IS DISTINCT FROM v_ev.current_item_id;

  -- 4. Completar la ventana.
  SELECT COUNT(*) INTO v_have FROM pantalla_playlist_items
   WHERE event_id = _event_id AND is_active_candidate
     AND id IS DISTINCT FROM v_ev.current_item_id;

  v_need := v_ev.active_candidates_count - v_have;
  IF v_need <= 0 THEN RETURN 0; END IF;

  WITH elegibles AS (
    SELECT id FROM pantalla_playlist_items
     WHERE event_id = _event_id
       AND enabled
       AND NOT is_active_candidate
       AND id IS DISTINCT FROM v_ev.current_item_id
       AND COALESCE(last_status, 'idle') <> 'rejected'
     ORDER BY
       -- Primero lo que nunca sonó y lo que hace más tiempo que no suena.
       (last_status = 'played_recently') ASC,
       times_played ASC,
       position ASC,
       created_at ASC
     LIMIT v_need
  )
  UPDATE pantalla_playlist_items pi SET
    is_active_candidate = true,
    last_status = 'active',
    last_status_changed_at = now(),
    consecutive_last_place_rounds = 0,
    pos_votes = 0, neg_votes = 0, score = 0
  FROM elegibles e WHERE pi.id = e.id;

  GET DIAGNOSTICS v_added = ROW_COUNT;
  RETURN v_added;
END $$;


-- ── Avance ──────────────────────────────────────────────────────────────────
-- Versión interna sin control de permisos: la usan el kick colectivo y la TV,
-- que se autorizan por sus propios medios.
CREATE OR REPLACE FUNCTION public.pantalla__advance(
  _event_id uuid,
  _force_item_id uuid DEFAULT NULL,
  _expected_current_id uuid DEFAULT NULL,
  _reason text DEFAULT 'advance'
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ev   pantalla_events%ROWTYPE;
  v_cur  pantalla_playlist_items%ROWTYPE;
  v_next uuid;
  v_worst uuid;
BEGIN
  -- Lock de fila: dos avances simultáneos (DJ + fin de video en la TV) se
  -- serializan acá en vez de pisarse.
  SELECT * INTO v_ev FROM pantalla_events WHERE id = _event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'event not found'; END IF;

  -- Optimistic locking: si el que pide el avance venía mirando otra canción,
  -- alguien ya avanzó. Equivale al `_expected_current_id` del original.
  IF _expected_current_id IS NOT NULL
     AND v_ev.current_item_id IS DISTINCT FROM _expected_current_id THEN
    RAISE EXCEPTION 'stale advance: current song already changed';
  END IF;

  -- 1. Archivar la que estaba sonando.
  IF v_ev.current_item_id IS NOT NULL THEN
    SELECT * INTO v_cur FROM pantalla_playlist_items WHERE id = v_ev.current_item_id;
    IF FOUND THEN
      INSERT INTO pantalla_play_history
        (event_id, item_id, title, artist, cover_url, final_score, pos_votes, neg_votes, ended_reason)
      VALUES
        (_event_id, v_cur.id, v_cur.title, v_cur.artist, v_cur.cover_url,
         v_cur.score, v_cur.pos_votes, v_cur.neg_votes, _reason);

      DELETE FROM pantalla_votes      WHERE item_id = v_cur.id;
      DELETE FROM pantalla_kick_votes WHERE item_id = v_cur.id;

      UPDATE pantalla_playlist_items SET
        times_played = times_played + 1,
        is_active_candidate = false,
        last_status = 'played_recently',
        last_status_changed_at = now(),
        consecutive_last_place_rounds = 0,
        pos_votes = 0, neg_votes = 0, score = 0,
        hot_until = NULL
      WHERE id = v_cur.id;
    END IF;
  END IF;

  -- 2. Elegir la próxima: la forzada por el DJ, o la #1 del ranking.
  IF _force_item_id IS NOT NULL THEN
    SELECT id INTO v_next FROM pantalla_playlist_items
     WHERE id = _force_item_id AND event_id = _event_id AND enabled;
    IF v_next IS NULL THEN RAISE EXCEPTION 'forced song not available'; END IF;
  ELSE
    SELECT id INTO v_next FROM pantalla_playlist_items
     WHERE event_id = _event_id AND is_active_candidate AND enabled
       AND id IS DISTINCT FROM v_ev.current_item_id
     ORDER BY score DESC, pos_votes DESC, position ASC, created_at ASC
     LIMIT 1;
  END IF;

  -- 3. Penalizar al último de la ronda (relegación por rondas consecutivas).
  SELECT id INTO v_worst FROM pantalla_playlist_items
   WHERE event_id = _event_id AND is_active_candidate AND enabled
     AND NOT locked AND NOT pinned
     AND id IS DISTINCT FROM v_next
   ORDER BY score ASC, position DESC
   LIMIT 1;

  IF v_worst IS NOT NULL THEN
    UPDATE pantalla_playlist_items
       SET consecutive_last_place_rounds = consecutive_last_place_rounds + 1
     WHERE id = v_worst;
  END IF;

  -- 4. Promover.
  IF v_next IS NOT NULL THEN
    DELETE FROM pantalla_votes WHERE item_id = v_next;
    UPDATE pantalla_playlist_items SET
      is_active_candidate = false,
      last_status = 'active',
      last_status_changed_at = now(),
      pos_votes = 0, neg_votes = 0, score = 0
    WHERE id = v_next;
  END IF;

  UPDATE pantalla_events SET
    current_item_id    = v_next,
    current_started_at = CASE WHEN v_next IS NOT NULL THEN now() ELSE NULL END,
    is_playing         = v_next IS NOT NULL,
    frozen_ranking     = NULL,
    voting_frozen      = false,
    tv_current_time    = 0
  WHERE id = _event_id;

  PERFORM public.pantalla_refill_candidates(_event_id);
  RETURN v_next;
END $$;

-- Versión pública: sólo admin/DJ.
CREATE OR REPLACE FUNCTION public.pantalla_advance_event(
  _event_id uuid,
  _force_item_id uuid DEFAULT NULL,
  _expected_current_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.pantalla_can_manage(_event_id) THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN public.pantalla__advance(_event_id, _force_item_id, _expected_current_id,
                                  CASE WHEN _force_item_id IS NOT NULL THEN 'manual' ELSE 'advance' END);
END $$;


-- ── Kick colectivo ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.pantalla_get_kick_status(_event_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ev pantalla_events%ROWTYPE;
  v_votes integer; v_active integer; v_needed integer; v_voted boolean;
BEGIN
  SELECT * INTO v_ev FROM pantalla_events WHERE id = _event_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('enabled', false); END IF;

  SELECT COUNT(*)::int INTO v_votes FROM pantalla_kick_votes
   WHERE event_id = _event_id AND item_id = v_ev.current_item_id;

  v_active := public.pantalla__active_count(_event_id);
  v_needed := GREATEST(1, CEIL(v_active * v_ev.kick_threshold_pct / 100.0)::int);

  SELECT EXISTS (SELECT 1 FROM pantalla_kick_votes
                 WHERE event_id = _event_id AND item_id = v_ev.current_item_id
                   AND user_id = auth.uid()) INTO v_voted;

  RETURN jsonb_build_object(
    'enabled',       v_ev.kick_enabled,
    'item_id',       v_ev.current_item_id,
    'votes',         v_votes,
    'active',        v_active,
    'needed',        v_needed,
    'threshold_pct', v_ev.kick_threshold_pct,
    'voted',         COALESCE(v_voted, false),
    'button_text',   v_ev.kick_button_text
  );
END $$;


CREATE OR REPLACE FUNCTION public.pantalla_toggle_kick_vote(_event_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_ev   pantalla_events%ROWTYPE;
  v_votes integer; v_active integer; v_needed integer;
  v_voted boolean := false; v_fired boolean := false;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT * INTO v_ev FROM pantalla_events WHERE id = _event_id;
  IF NOT FOUND                 THEN RAISE EXCEPTION 'event not found'; END IF;
  IF v_ev.status <> 'live'     THEN RAISE EXCEPTION 'event not live'; END IF;
  IF NOT v_ev.kick_enabled     THEN RAISE EXCEPTION 'kick disabled'; END IF;
  IF v_ev.current_item_id IS NULL THEN RAISE EXCEPTION 'no current song'; END IF;

  PERFORM public.pantalla__ensure_participant(_event_id, v_user);

  -- El servidor lleva la cuenta; el contador del cliente es sólo decorativo.
  DELETE FROM pantalla_kick_votes
   WHERE event_id = _event_id AND item_id = v_ev.current_item_id AND user_id = v_user;

  IF NOT FOUND THEN
    INSERT INTO pantalla_kick_votes (event_id, item_id, user_id)
    VALUES (_event_id, v_ev.current_item_id, v_user);
    v_voted := true;
  END IF;

  SELECT COUNT(*)::int INTO v_votes FROM pantalla_kick_votes
   WHERE event_id = _event_id AND item_id = v_ev.current_item_id;

  v_active := public.pantalla__active_count(_event_id);
  v_needed := GREATEST(1, CEIL(v_active * v_ev.kick_threshold_pct / 100.0)::int);

  IF v_voted AND v_votes >= v_needed THEN
    PERFORM public.pantalla__advance(_event_id, NULL, v_ev.current_item_id, 'kick');
    v_fired := true;
  END IF;

  RETURN jsonb_build_object('ok', true, 'voted', v_voted, 'fired', v_fired,
                            'votes', v_votes, 'active', v_active, 'needed', v_needed);
END $$;
