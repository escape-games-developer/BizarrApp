-- ============================================================================
-- PANTALLA/ESCENARIO — El historial guarda el score con el que ganó el tema
--
-- Detectado probando el motor: cuando un tema gana la votación pasa a "sonando"
-- y se le limpian los votos (nadie vota lo que ya está sonando). Al archivarlo
-- después, `final_score` siempre salía 0. Ahora el score ganador se congela en
-- el momento de la promoción y es lo que se archiva.
-- ============================================================================

ALTER TABLE pantalla_playlist_items
  ADD COLUMN IF NOT EXISTS won_with_score integer,
  ADD COLUMN IF NOT EXISTS won_with_pos   integer,
  ADD COLUMN IF NOT EXISTS won_with_neg   integer;

COMMENT ON COLUMN pantalla_playlist_items.won_with_score IS
  'Score con el que ganó la votación al ser promovida a actual. Es lo que se archiva en el historial.';

CREATE OR REPLACE FUNCTION public.pantalla__advance(
  _event_id uuid, _force_item_id uuid DEFAULT NULL,
  _expected_current_id uuid DEFAULT NULL, _reason text DEFAULT 'advance'
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_ev pantalla_events%ROWTYPE; v_cur pantalla_playlist_items%ROWTYPE;
  v_next uuid; v_worst uuid;
BEGIN
  -- Lock de fila: dos avances simultáneos (el DJ y el fin de video en la TV)
  -- se serializan acá en vez de pisarse.
  SELECT * INTO v_ev FROM pantalla_events WHERE id = _event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'event not found'; END IF;

  -- Optimistic locking, equivalente al `_expected_current_id` del original.
  IF _expected_current_id IS NOT NULL AND v_ev.current_item_id IS DISTINCT FROM _expected_current_id THEN
    RAISE EXCEPTION 'stale advance: current song already changed';
  END IF;

  -- 1. Archivar la que estaba sonando, con el score que la hizo ganar.
  IF v_ev.current_item_id IS NOT NULL THEN
    SELECT * INTO v_cur FROM pantalla_playlist_items WHERE id = v_ev.current_item_id;
    IF FOUND THEN
      INSERT INTO pantalla_play_history
        (event_id, item_id, title, artist, cover_url, final_score, pos_votes, neg_votes, ended_reason)
      VALUES (_event_id, v_cur.id, v_cur.title, v_cur.artist, v_cur.cover_url,
              COALESCE(v_cur.won_with_score, v_cur.score),
              COALESCE(v_cur.won_with_pos,   v_cur.pos_votes),
              COALESCE(v_cur.won_with_neg,   v_cur.neg_votes),
              _reason);
      DELETE FROM pantalla_votes      WHERE item_id = v_cur.id;
      DELETE FROM pantalla_kick_votes WHERE item_id = v_cur.id;
      UPDATE pantalla_playlist_items SET
        times_played = times_played + 1, is_active_candidate = false,
        last_status = 'played_recently', last_status_changed_at = now(),
        consecutive_last_place_rounds = 0, pos_votes = 0, neg_votes = 0, score = 0,
        hot_until = NULL, won_with_score = NULL, won_with_pos = NULL, won_with_neg = NULL
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
     ORDER BY score DESC, pos_votes DESC, position ASC, created_at ASC LIMIT 1;
  END IF;

  -- 3. Penalizar al último de la ronda (relegación por rondas consecutivas).
  SELECT id INTO v_worst FROM pantalla_playlist_items
   WHERE event_id = _event_id AND is_active_candidate AND enabled
     AND NOT locked AND NOT pinned AND id IS DISTINCT FROM v_next
   ORDER BY score ASC, position DESC LIMIT 1;
  IF v_worst IS NOT NULL THEN
    UPDATE pantalla_playlist_items SET consecutive_last_place_rounds = consecutive_last_place_rounds + 1
     WHERE id = v_worst;
  END IF;

  -- 4. Promover: congela el score ganador y arranca limpia.
  IF v_next IS NOT NULL THEN
    DELETE FROM pantalla_votes WHERE item_id = v_next;
    UPDATE pantalla_playlist_items SET
      is_active_candidate = false, last_status = 'active', last_status_changed_at = now(),
      won_with_score = score, won_with_pos = pos_votes, won_with_neg = neg_votes,
      pos_votes = 0, neg_votes = 0, score = 0
    WHERE id = v_next;
  END IF;

  UPDATE pantalla_events SET
    current_item_id = v_next,
    current_started_at = CASE WHEN v_next IS NOT NULL THEN now() ELSE NULL END,
    is_playing = v_next IS NOT NULL,
    frozen_ranking = NULL, voting_frozen = false, tv_current_time = 0
  WHERE id = _event_id;

  PERFORM public.pantalla_refill_candidates(_event_id);
  RETURN v_next;
END $fn$;
