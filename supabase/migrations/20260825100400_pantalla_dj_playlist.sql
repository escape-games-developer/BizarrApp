-- ============================================================================
-- PANTALLA/ESCENARIO — Carga de la playlist del evento
--
-- Dos caminos, los dos exclusivos del admin (el cliente nunca agrega temas):
--   1. pegar links de YouTube, como en DJ Democracy
--   2. importar una playlist interna ya curada en BizarrApp (`playlists` /
--      `playlist_items`), para no duplicar el catálogo que el bar ya cargó
-- ============================================================================

-- _items: [{youtube_id, title, artist, cover_url, trim_start_seconds, trim_end_seconds}]
CREATE OR REPLACE FUNCTION public.pantalla_add_items(_event_id uuid, _items jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_base integer; v_count integer;
BEGIN
  IF NOT public.pantalla_can_manage(_event_id) THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF jsonb_typeof(_items) <> 'array' THEN RAISE EXCEPTION 'items must be an array'; END IF;

  SELECT COALESCE(MAX(position), 0) INTO v_base FROM pantalla_playlist_items WHERE event_id = _event_id;

  WITH nuevos AS (
    SELECT it, row_number() OVER () AS rn
      FROM jsonb_array_elements(_items) it
     WHERE COALESCE(it->>'youtube_id','') <> ''
  )
  INSERT INTO pantalla_playlist_items
    (event_id, title, artist, cover_url, source_type, youtube_id,
     trim_start_seconds, trim_end_seconds, position)
  SELECT _event_id,
         COALESCE(NULLIF(trim(it->>'title'), ''), 'Sin titulo'),
         NULLIF(trim(COALESCE(it->>'artist','')), ''),
         -- Portada por defecto: el thumbnail del propio video.
         COALESCE(NULLIF(it->>'cover_url',''),
                  'https://i.ytimg.com/vi/' || (it->>'youtube_id') || '/mqdefault.jpg'),
         'youtube', it->>'youtube_id',
         COALESCE((it->>'trim_start_seconds')::int, 0),
         NULLIF(it->>'trim_end_seconds','')::int,
         v_base + rn
    FROM nuevos;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  PERFORM public.pantalla_refill_candidates(_event_id);
  RETURN v_count;
END $fn$;

-- Importa desde las playlists internas de BizarrApp. Salta los temas que el
-- evento ya tiene, así se puede reimportar sin duplicar.
CREATE OR REPLACE FUNCTION public.pantalla_import_playlist(_event_id uuid, _playlist_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_base integer; v_count integer;
BEGIN
  IF NOT public.pantalla_can_manage(_event_id) THEN RAISE EXCEPTION 'not authorized'; END IF;

  SELECT COALESCE(MAX(position), 0) INTO v_base FROM pantalla_playlist_items WHERE event_id = _event_id;

  INSERT INTO pantalla_playlist_items
    (event_id, title, artist, cover_url, source_type, youtube_id, duration_seconds, position)
  SELECT _event_id,
         COALESCE(NULLIF(trim(pi.title), ''), 'Sin titulo'),
         pi.artist,
         COALESCE(pi.thumb_url, 'https://i.ytimg.com/vi/' || pi.yt_id || '/mqdefault.jpg'),
         'youtube', pi.yt_id, pi.duration_seconds,
         v_base + row_number() OVER (ORDER BY pi.position, pi.added_at)
    FROM playlist_items pi
   WHERE pi.playlist_id = _playlist_id
     AND pi.yt_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pantalla_playlist_items x
                     WHERE x.event_id = _event_id AND x.youtube_id = pi.yt_id);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  PERFORM public.pantalla_refill_candidates(_event_id);
  RETURN v_count;
END $fn$;

-- Duplica config + playlist, sin arrastrar votos, historial ni estado.
CREATE OR REPLACE FUNCTION public.pantalla_duplicate_event(_event_id uuid, _name text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_new uuid;
BEGIN
  IF NOT public.pantalla_can_manage(_event_id) THEN RAISE EXCEPTION 'not authorized'; END IF;

  INSERT INTO pantalla_events (
    session_id, owner_id, name, code, status,
    voting_mode, active_candidates_count, relegation_rounds_threshold,
    reject_score_threshold, super_votes_per_user,
    kick_enabled, kick_threshold_pct, kick_activity_minutes, kick_button_text, content_mode)
  SELECT session_id, auth.uid(),
         COALESCE(NULLIF(trim(_name),''), name || ' (copia)'),
         public.pantalla__new_code(), 'draft',
         voting_mode, active_candidates_count, relegation_rounds_threshold,
         reject_score_threshold, super_votes_per_user,
         kick_enabled, kick_threshold_pct, kick_activity_minutes, kick_button_text, content_mode
    FROM pantalla_events WHERE id = _event_id
  RETURNING id INTO v_new;

  INSERT INTO pantalla_event_secrets (event_id) VALUES (v_new);

  INSERT INTO pantalla_vote_powers (event_id, role, vote_type, enabled, value)
  SELECT v_new, role, vote_type, enabled, value FROM pantalla_vote_powers WHERE event_id = _event_id;

  INSERT INTO pantalla_playlist_items
    (event_id, title, artist, album, cover_url, source_type, youtube_id, audio_path,
     duration_seconds, position, enabled, locked, pinned,
     trim_start_seconds, trim_end_seconds, youtube_volume)
  SELECT v_new, title, artist, album, cover_url, source_type, youtube_id, audio_path,
         duration_seconds, position, enabled, locked, pinned,
         trim_start_seconds, trim_end_seconds, youtube_volume
    FROM pantalla_playlist_items WHERE event_id = _event_id;

  RETURN v_new;
END $fn$;
