-- Duelo de Talentos V1 — cierre backend.
-- Lleva producción desde su estado ACTUAL (incluidos los objetos creados fuera del
-- historial: duelo_postulaciones, columnas duelo_* de game_state, CHECK de game_type
-- con 'duelo', bucket videos-locales, EXECUTE de anon) al contrato definitivo.
-- No recrea ni repite migraciones anteriores.
--
-- Contrato:
-- * Rondas de Duelo en applause_sessions (game_type='duelo').
--   Activas = idle | countdown | voting  → como máximo UNA por sesión (índice único parcial).
--   finished  = resultado persistido (result p1 | p2 | tie; winner_slot NULL en empate).
--   cancelled = cancelación operativa, sin ganador (cancel_reason manual | new_round | expired).
-- * RPC autoritativas: duelo_launch_round / duelo_finish_round / duelo_cancel_round.
--   applause_add endurecida para Duelo (códigos jsonb). applause_finish delega a
--   duelo_finish_round cuando la ronda es de Duelo. Las ramas personal_trainer /
--   follow_leader conservan su lógica anterior.
-- * Reglas: duelo_reglas_config (duracion_votacion ON/OFF + segundos; max_aplausos_usuario).
-- * Postulaciones: el cliente sólo se postula a sí mismo, en 'waiting', en sesión activa;
--   la identidad se toma de profiles (no del cliente).
-- * Storage videos-locales: subir y borrar sólo admin; lectura pública.
-- * anon sin EXECUTE y sin escritura en las tablas del Duelo.

-- ═══ 1. Storage videos-locales ══════════════════════════════════════════════
DROP POLICY IF EXISTS videos_locales_authenticated_upload ON storage.objects;
DROP POLICY IF EXISTS videos_locales_authenticated_delete ON storage.objects;

CREATE POLICY videos_locales_admin_upload ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'videos-locales'
              AND EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));

CREATE POLICY videos_locales_admin_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'videos-locales'
         AND EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));
-- videos_locales_public_read se mantiene (la Pantalla corre como anon).

-- ═══ 2. Reglas configurables ═══════════════════════════════════════════════
CREATE TABLE public.duelo_reglas_config (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  key        text        NOT NULL UNIQUE,
  enabled    boolean     NOT NULL DEFAULT true,
  value      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT duelo_reglas_config_key_valida
    CHECK (key IN ('duracion_votacion', 'max_aplausos_usuario')),
  CONSTRAINT duelo_reglas_config_value_objeto
    CHECK (jsonb_typeof(value) = 'object'),
  CONSTRAINT duelo_reglas_config_duracion_valida
    CHECK (key <> 'duracion_votacion' OR
           CASE WHEN jsonb_typeof(value -> 'segundos') = 'number'
                     AND (value - 'segundos') = '{}'::jsonb
                     AND (value ->> 'segundos') ~ '^[1-9][0-9]*$'
                THEN (value ->> 'segundos')::int BETWEEN 10 AND 600
                ELSE false END),
  CONSTRAINT duelo_reglas_config_max_aplausos_valido
    CHECK (key <> 'max_aplausos_usuario' OR
           CASE WHEN enabled
                     AND jsonb_typeof(value -> 'max') = 'number'
                     AND (value - 'max') = '{}'::jsonb
                     AND (value ->> 'max') ~ '^[1-9][0-9]*$'
                THEN (value ->> 'max')::int BETWEEN 10 AND 1000
                ELSE false END)
);

CREATE FUNCTION public.duelo_reglas_config_touch()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := coalesce(auth.uid(), NEW.updated_by);
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.duelo_reglas_config_touch() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER duelo_reglas_config_touch
  BEFORE UPDATE ON public.duelo_reglas_config
  FOR EACH ROW EXECUTE FUNCTION public.duelo_reglas_config_touch();

ALTER TABLE public.duelo_reglas_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "duelo_reglas_config: admin lee"
  ON public.duelo_reglas_config FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "duelo_reglas_config: admin actualiza"
  ON public.duelo_reglas_config FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

REVOKE ALL ON TABLE public.duelo_reglas_config FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.duelo_reglas_config TO authenticated;
GRANT UPDATE (enabled, value) ON TABLE public.duelo_reglas_config TO authenticated;
GRANT ALL ON TABLE public.duelo_reglas_config TO service_role;

INSERT INTO public.duelo_reglas_config (key, enabled, value) VALUES
  ('duracion_votacion',    true, '{"segundos": 60}'),
  ('max_aplausos_usuario', true, '{"max": 100}');

-- ═══ 3. applause_sessions: estados, resultado, una ronda activa ════════════
ALTER TABLE public.applause_sessions
  ADD COLUMN finished_at   timestamptz,
  ADD COLUMN cancel_reason text,
  ADD COLUMN result        text,
  ADD COLUMN tap_limit     integer;

ALTER TABLE public.applause_sessions DROP CONSTRAINT applause_sessions_status_check;
ALTER TABLE public.applause_sessions
  ADD CONSTRAINT applause_sessions_status_check
    CHECK (status IN ('idle', 'countdown', 'voting', 'finished', 'cancelled')),
  ADD CONSTRAINT applause_sessions_cancel_reason_check
    CHECK (cancel_reason IS NULL OR cancel_reason IN ('manual', 'new_round', 'expired')),
  ADD CONSTRAINT applause_sessions_result_check
    CHECK (result IS NULL OR result IN ('p1', 'p2', 'tie')),
  ADD CONSTRAINT applause_sessions_tap_limit_check
    CHECK (tap_limit IS NULL OR tap_limit BETWEEN 1 AND 10000),
  ADD CONSTRAINT applause_sessions_cancelled_consistente
    CHECK (status <> 'cancelled'
           OR (cancel_reason IS NOT NULL AND finished_at IS NOT NULL
               AND winner_slot IS NULL AND result IS NULL)),
  ADD CONSTRAINT applause_sessions_activa_consistente
    CHECK (status NOT IN ('idle', 'countdown', 'voting')
           OR (winner_slot IS NULL AND result IS NULL AND cancel_reason IS NULL)),
  ADD CONSTRAINT applause_sessions_duelo_consistente
    CHECK (game_type <> 'duelo'
           OR (p1_user_id IS NOT NULL AND p2_user_id IS NOT NULL
               AND p1_user_id <> p2_user_id AND tap_limit IS NOT NULL
               AND (status <> 'finished'
                    OR (finished_at IS NOT NULL AND cancel_reason IS NULL
                        AND ((result = 'p1'  AND winner_slot = 1)
                          OR (result = 'p2'  AND winner_slot = 2)
                          OR (result = 'tie' AND winner_slot IS NULL))))));

CREATE UNIQUE INDEX applause_sessions_duelo_una_activa_idx
  ON public.applause_sessions (session_id)
  WHERE game_type = 'duelo' AND status IN ('idle', 'countdown', 'voting');

-- Escritura directa eliminada: toda escritura del Duelo pasa por RPC.
DROP POLICY IF EXISTS applause_sessions_admin_all ON public.applause_sessions;

REVOKE ALL ON TABLE public.applause_sessions     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.applause_counts       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.applause_user_contrib FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.applause_sessions TO anon, authenticated;
GRANT SELECT ON TABLE public.applause_counts   TO anon, authenticated;
GRANT SELECT ON TABLE public.applause_user_contrib TO authenticated;
GRANT ALL ON TABLE public.applause_sessions, public.applause_counts, public.applause_user_contrib TO service_role;

-- ═══ 4. duelo_postulaciones ════════════════════════════════════════════════
CREATE FUNCTION public.duelo_postulacion_identidad()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_p record;
BEGIN
  -- La identidad proyectable sale de profiles, nunca del payload del cliente.
  SELECT name, avatar_id, avatar_emoji, photo_url INTO v_p
    FROM public.profiles WHERE id = NEW.user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El usuario no tiene perfil'
      USING ERRCODE = '23514', HINT = 'PROFILE_REQUIRED';
  END IF;
  NEW.user_name    := left(coalesce(nullif(btrim(regexp_replace(coalesce(v_p.name, ''), '\s+', ' ', 'g')), ''), 'Jugador'), 40);
  NEW.avatar_id    := CASE WHEN v_p.avatar_id ~ '^[A-Za-z0-9_-]{1,32}$' THEN v_p.avatar_id END;
  NEW.avatar_emoji := CASE WHEN char_length(v_p.avatar_emoji) BETWEEN 1 AND 8 THEN v_p.avatar_emoji END;
  NEW.photo_url    := CASE WHEN v_p.photo_url ~ '^https://zkltjvgbpzelwzsphurg\.supabase\.co/storage/v1/object/public/bizarren-media/[A-Za-z0-9._/-]+$'
                           THEN v_p.photo_url END;
  NEW.created_at   := now();
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.duelo_postulacion_identidad() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER duelo_postulacion_identidad
  BEFORE INSERT ON public.duelo_postulaciones
  FOR EACH ROW EXECUTE FUNCTION public.duelo_postulacion_identidad();

DROP POLICY IF EXISTS duelo_post_insert ON public.duelo_postulaciones;
CREATE POLICY duelo_post_insert ON public.duelo_postulaciones
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id
              AND status = 'waiting'
              AND EXISTS (SELECT 1 FROM public.sessions s
                           WHERE s.id = duelo_postulaciones.session_id AND s.is_active));

DROP POLICY IF EXISTS duelo_post_update ON public.duelo_postulaciones;
CREATE POLICY duelo_post_update ON public.duelo_postulaciones
  FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

REVOKE ALL ON TABLE public.duelo_postulaciones FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON TABLE public.duelo_postulaciones TO authenticated;
GRANT INSERT (session_id, user_id, user_name, avatar_id, avatar_emoji, photo_url, status)
  ON TABLE public.duelo_postulaciones TO authenticated;
GRANT UPDATE (status) ON TABLE public.duelo_postulaciones TO authenticated;
GRANT ALL ON TABLE public.duelo_postulaciones TO service_role;

-- ═══ 5. RPC: lanzamiento ═══════════════════════════════════════════════════
CREATE FUNCTION public.duelo_launch_round(
  p_session       uuid,
  p_postulacion_1 uuid,
  p_postulacion_2 uuid,
  p_video         jsonb DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_now      timestamptz := now();
  v_video    jsonb;
  v_dur_on   boolean;
  v_dur_val  jsonb;
  v_max_val  jsonb;
  v_seconds  int;
  v_limit    int;
  v_ends     timestamptz;
  v_p1       record;
  v_p2       record;
  v_prev     jsonb;
  v_round    uuid;
  v_slot1    jsonb;
  v_slot2    jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'UNAUTHORIZED', 'error', 'Solo un administrador puede lanzar el Duelo');
  END IF;
  IF p_session IS NULL OR p_postulacion_1 IS NULL OR p_postulacion_2 IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_REQUEST', 'error', 'Faltan la sesión o los dos participantes');
  END IF;
  IF p_postulacion_1 = p_postulacion_2 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'SAME_PARTICIPANT', 'error', 'Los dos participantes tienen que ser distintos');
  END IF;

  -- Video opcional: NULL, o {source:'youtube', yt_id} / {source:'url', video_url}.
  IF p_video IS NOT NULL AND jsonb_typeof(p_video) <> 'null' THEN
    IF jsonb_typeof(p_video) <> 'object'
       OR (p_video - ARRAY['source', 'yt_id', 'video_url', 'title']) <> '{}'::jsonb
       OR jsonb_typeof(coalesce(p_video -> 'title', 'null'::jsonb)) NOT IN ('null', 'string')
       OR char_length(coalesce(p_video ->> 'title', '')) > 200
       OR NOT coalesce(
            (p_video ->> 'source' = 'youtube'
               AND coalesce(p_video ->> 'yt_id', '') ~ '^[A-Za-z0-9_-]{11}$')
         OR (p_video ->> 'source' = 'url'
               AND coalesce(p_video ->> 'video_url', '') ~* '^https?://[^[:space:]]+$'
               AND char_length(p_video ->> 'video_url') <= 2048), false) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'INVALID_VIDEO', 'error', 'Video inválido: YouTube (yt_id) o URL http(s)');
    END IF;
    v_video := jsonb_build_object(
      'source',    p_video ->> 'source',
      'yt_id',     CASE WHEN p_video ->> 'source' = 'youtube' THEN p_video ->> 'yt_id' END,
      'video_url', CASE WHEN p_video ->> 'source' = 'url' THEN p_video ->> 'video_url' END,
      'title',     p_video ->> 'title');
  END IF;

  -- Orden de locks del proyecto: game_state primero.
  PERFORM 1 FROM public.game_state WHERE session_id = p_session FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'SESSION_NOT_FOUND', 'error', 'La sesión no tiene game_state');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.sessions WHERE id = p_session AND is_active) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'SESSION_INACTIVE', 'error', 'La sesión no está activa');
  END IF;

  SELECT enabled, value INTO v_dur_on, v_dur_val FROM public.duelo_reglas_config WHERE key = 'duracion_votacion';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'CONFIG_INCOMPLETE', 'error', 'Falta la regla duracion_votacion');
  END IF;
  SELECT value INTO v_max_val FROM public.duelo_reglas_config WHERE key = 'max_aplausos_usuario';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'CONFIG_INCOMPLETE', 'error', 'Falta la regla max_aplausos_usuario');
  END IF;
  v_seconds := (v_dur_val ->> 'segundos')::int;
  v_limit   := (v_max_val ->> 'max')::int;
  v_ends    := CASE WHEN v_dur_on THEN v_now + make_interval(secs => v_seconds) END;

  SELECT id, session_id, user_id, user_name, avatar_id, avatar_emoji, photo_url, status INTO v_p1
    FROM public.duelo_postulaciones WHERE id = p_postulacion_1 FOR UPDATE;
  IF NOT FOUND OR v_p1.session_id <> p_session OR v_p1.status NOT IN ('waiting', 'selected') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'PARTICIPANT_INVALID', 'slot', 1,
      'reason', CASE WHEN NOT FOUND OR v_p1.id IS NULL THEN 'NOT_FOUND'
                     WHEN v_p1.session_id <> p_session THEN 'OTHER_SESSION'
                     ELSE 'STATUS_' || upper(v_p1.status) END,
      'error', 'El participante 1 no es una postulación válida de esta sesión');
  END IF;
  SELECT id, session_id, user_id, user_name, avatar_id, avatar_emoji, photo_url, status INTO v_p2
    FROM public.duelo_postulaciones WHERE id = p_postulacion_2 FOR UPDATE;
  IF NOT FOUND OR v_p2.session_id <> p_session OR v_p2.status NOT IN ('waiting', 'selected') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'PARTICIPANT_INVALID', 'slot', 2,
      'reason', CASE WHEN NOT FOUND OR v_p2.id IS NULL THEN 'NOT_FOUND'
                     WHEN v_p2.session_id <> p_session THEN 'OTHER_SESSION'
                     ELSE 'STATUS_' || upper(v_p2.status) END,
      'error', 'El participante 2 no es una postulación válida de esta sesión');
  END IF;
  IF v_p1.user_id = v_p2.user_id THEN
    RETURN jsonb_build_object('ok', false, 'code', 'SAME_PARTICIPANT', 'error', 'Los dos participantes son la misma persona');
  END IF;

  v_slot1 := jsonb_build_object('user_id', v_p1.user_id, 'name', v_p1.user_name, 'avatar_id', v_p1.avatar_id,
                                'avatar_emoji', v_p1.avatar_emoji, 'photo_url', v_p1.photo_url, 'postulacion_id', v_p1.id);
  v_slot2 := jsonb_build_object('user_id', v_p2.user_id, 'name', v_p2.user_name, 'avatar_id', v_p2.avatar_id,
                                'avatar_emoji', v_p2.avatar_emoji, 'photo_url', v_p2.photo_url, 'postulacion_id', v_p2.id);

  BEGIN
    WITH c AS (
      UPDATE public.applause_sessions
         SET status = 'cancelled', cancel_reason = 'new_round', finished_at = v_now
       WHERE session_id = p_session AND game_type = 'duelo'
         AND status IN ('idle', 'countdown', 'voting')
      RETURNING id)
    SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_prev FROM c;

    INSERT INTO public.applause_sessions
      (session_id, game_type, status,
       p1_user_id, p1_name, p1_avatar,
       p2_user_id, p2_name, p2_avatar,
       voting_ends_at, tap_limit)
    VALUES
      (p_session, 'duelo', 'voting',
       v_p1.user_id, v_p1.user_name,
       jsonb_build_object('avatar_id', v_p1.avatar_id, 'avatar_emoji', v_p1.avatar_emoji, 'photo_url', v_p1.photo_url)::text,
       v_p2.user_id, v_p2.user_name,
       jsonb_build_object('avatar_id', v_p2.avatar_id, 'avatar_emoji', v_p2.avatar_emoji, 'photo_url', v_p2.photo_url)::text,
       v_ends, v_limit)
    RETURNING id INTO v_round;

    INSERT INTO public.applause_counts (round_id, slot, total) VALUES (v_round, 1, 0), (v_round, 2, 0);

    UPDATE public.duelo_postulaciones SET status = 'selected' WHERE id IN (v_p1.id, v_p2.id);

    UPDATE public.game_state
       SET active_escenario = 'duelo', active_game = NULL, active_placa = NULL, placa_custom = NULL,
           duelo_state = 'voting', duelo_slot1 = v_slot1, duelo_slot2 = v_slot2, duelo_video = v_video,
           duelo_winner = NULL, duelo_votes_a = 0, duelo_votes_b = 0
     WHERE session_id = p_session;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'code', 'CONFLICT', 'error', 'Otro lanzamiento se cruzó con este; reintentá');
  END;

  RETURN jsonb_build_object(
    'ok', true, 'code', 'LAUNCHED',
    'round_id', v_round,
    'session_id', p_session,
    'p1', v_slot1,
    'p2', v_slot2,
    'video', v_video,
    'voting_ends_at', v_ends,
    'duration_seconds', CASE WHEN v_dur_on THEN v_seconds END,
    'timed', v_dur_on,
    'tap_limit', v_limit,
    'previous_rounds_cancelled', v_prev);
END;
$function$;

-- ═══ 6. RPC: finalización ══════════════════════════════════════════════════
CREATE FUNCTION public.duelo_finish_round(p_round uuid, p_force boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_now    timestamptz := now();
  v_user   uuid := auth.uid();
  v_admin  boolean;
  v_force  boolean := coalesce(p_force, false);
  v_r      record;
  v_t1     bigint;
  v_t2     bigint;
  v_slot   int;
  v_result text;
  v_winner uuid;
  v_rows   int := 0;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'UNAUTHORIZED', 'error', 'No autenticado');
  END IF;
  IF p_round IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_REQUEST', 'error', 'Falta la ronda');
  END IF;
  v_admin := EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = v_user);
  IF v_force AND NOT v_admin THEN
    RETURN jsonb_build_object('ok', false, 'code', 'UNAUTHORIZED', 'error', 'Solo un administrador puede forzar el cierre');
  END IF;

  SELECT session_id, game_type INTO v_r FROM public.applause_sessions WHERE id = p_round;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ROUND_NOT_FOUND', 'error', 'La ronda no existe');
  END IF;
  IF v_r.game_type <> 'duelo' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_GAME_TYPE', 'error', 'La ronda no es de Duelo');
  END IF;

  PERFORM 1 FROM public.game_state WHERE session_id = v_r.session_id FOR UPDATE;
  SELECT * INTO v_r FROM public.applause_sessions WHERE id = p_round FOR UPDATE;

  IF v_r.status = 'finished' THEN
    SELECT coalesce(max(total) FILTER (WHERE slot = 1), 0), coalesce(max(total) FILTER (WHERE slot = 2), 0)
      INTO v_t1, v_t2 FROM public.applause_counts WHERE round_id = p_round;
    RETURN jsonb_build_object('ok', true, 'code', 'ALREADY_FINISHED', 'round_id', p_round,
      'result', v_r.result, 'winner_slot', v_r.winner_slot,
      'winner_user_id', CASE v_r.winner_slot WHEN 1 THEN v_r.p1_user_id WHEN 2 THEN v_r.p2_user_id END,
      'votes_p1', v_t1, 'votes_p2', v_t2);
  END IF;
  IF v_r.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ROUND_CANCELLED', 'error', 'La ronda fue cancelada',
      'round_id', p_round, 'cancel_reason', v_r.cancel_reason);
  END IF;
  IF NOT v_force THEN
    IF v_r.voting_ends_at IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'code', 'VOTING_STILL_OPEN',
        'error', 'Ronda sin temporizador: la cierra el administrador', 'round_id', p_round);
    END IF;
    IF v_now < v_r.voting_ends_at THEN
      RETURN jsonb_build_object('ok', false, 'code', 'VOTING_STILL_OPEN', 'error', 'La votación sigue abierta',
        'round_id', p_round, 'seconds_left', ceil(extract(epoch FROM v_r.voting_ends_at - v_now))::int);
    END IF;
  END IF;

  SELECT coalesce(max(total) FILTER (WHERE slot = 1), 0), coalesce(max(total) FILTER (WHERE slot = 2), 0)
    INTO v_t1, v_t2 FROM public.applause_counts WHERE round_id = p_round;
  v_slot   := CASE WHEN v_t1 > v_t2 THEN 1 WHEN v_t2 > v_t1 THEN 2 END;
  v_result := CASE v_slot WHEN 1 THEN 'p1' WHEN 2 THEN 'p2' ELSE 'tie' END;
  v_winner := CASE v_slot WHEN 1 THEN v_r.p1_user_id WHEN 2 THEN v_r.p2_user_id END;

  UPDATE public.applause_sessions
     SET status = 'finished', winner_slot = v_slot, result = v_result, finished_at = v_now
   WHERE id = p_round;

  -- Presentación: sólo si la Pantalla está mostrando esta votación.
  UPDATE public.game_state
     SET duelo_state = 'revealed', duelo_winner = v_winner,
         duelo_votes_a = LEAST(v_t1, 2147483647)::int, duelo_votes_b = LEAST(v_t2, 2147483647)::int
   WHERE session_id = v_r.session_id AND duelo_state = 'voting'
     AND duelo_slot1 ->> 'user_id' = v_r.p1_user_id::text
     AND duelo_slot2 ->> 'user_id' = v_r.p2_user_id::text;
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'code', 'FINISHED', 'round_id', p_round,
    'result', v_result, 'winner_slot', v_slot, 'winner_user_id', v_winner,
    'votes_p1', v_t1, 'votes_p2', v_t2, 'forced', v_force, 'game_state_synced', v_rows > 0);
END;
$function$;

-- ═══ 7. RPC: cancelación / vuelta a estado limpio ══════════════════════════
CREATE FUNCTION public.duelo_cancel_round(p_session uuid, p_clear_screen boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_now   timestamptz := now();
  v_ids   jsonb;
  v_clear boolean := coalesce(p_clear_screen, true);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'UNAUTHORIZED', 'error', 'Solo un administrador puede cancelar el Duelo');
  END IF;
  IF p_session IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_REQUEST', 'error', 'Falta la sesión');
  END IF;

  PERFORM 1 FROM public.game_state WHERE session_id = p_session FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'SESSION_NOT_FOUND', 'error', 'La sesión no tiene game_state');
  END IF;

  WITH c AS (
    UPDATE public.applause_sessions
       SET status = 'cancelled', cancel_reason = 'manual', finished_at = v_now
     WHERE session_id = p_session AND game_type = 'duelo'
       AND status IN ('idle', 'countdown', 'voting')
    RETURNING id)
  SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids FROM c;

  UPDATE public.game_state
     SET duelo_state = 'idle', duelo_slot1 = NULL, duelo_slot2 = NULL, duelo_video = NULL,
         duelo_winner = NULL, duelo_votes_a = 0, duelo_votes_b = 0,
         active_escenario = CASE WHEN v_clear AND active_escenario = 'duelo' THEN NULL ELSE active_escenario END
   WHERE session_id = p_session;

  RETURN jsonb_build_object('ok', true,
    'code', CASE WHEN jsonb_array_length(v_ids) > 0 THEN 'CANCELLED' ELSE 'NO_ACTIVE_ROUND' END,
    'cancelled_count', jsonb_array_length(v_ids), 'cancelled_round_ids', v_ids,
    'screen_cleared', v_clear);
END;
$function$;

-- ═══ 8. applause_add: endurecida para Duelo ════════════════════════════════
DROP FUNCTION public.applause_add(uuid, integer, integer);

CREATE FUNCTION public.applause_add(p_round uuid, p_slot integer, p_delta integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  c_max_delta  constant int      := 50;                   -- taps por llamada (el cliente agrupa cada ~500 ms)
  c_presencia  constant interval := interval '2 minutes'; -- misma ventana que Sumate / Rey
  c_legacy_max constant int      := 300;                  -- ramas personal_trainer / follow_leader (sin cambios)
  v_now       timestamptz := now();
  v_hoy       date := ((v_now AT TIME ZONE 'America/Argentina/Buenos_Aires') - interval '6 hours')::date;
  v_user      uuid := auth.uid();
  v_r         record;
  v_used      int;
  v_remaining int;
  v_accepted  int;
  v_current   int;
  v_allowed   int;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'UNAUTHORIZED', 'error', 'No autenticado');
  END IF;
  IF p_round IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_REQUEST', 'error', 'Falta la ronda');
  END IF;

  SELECT id, session_id, game_type, status, voting_ends_at, created_at, p1_user_id, p2_user_id, tap_limit
    INTO v_r FROM public.applause_sessions WHERE id = p_round;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ROUND_NOT_FOUND', 'error', 'La ronda no existe');
  END IF;

  -- ── personal_trainer / follow_leader: lógica anterior intacta ──
  IF v_r.game_type <> 'duelo' THEN
    IF p_slot NOT IN (1, 2) THEN RETURN jsonb_build_object('ok', false, 'code', 'LEGACY_IGNORED'); END IF;
    IF v_r.status <> 'voting' THEN RETURN jsonb_build_object('ok', false, 'code', 'LEGACY_IGNORED'); END IF;
    INSERT INTO public.applause_user_contrib (round_id, user_id, slot, count)
    VALUES (p_round, v_user, p_slot, 0) ON CONFLICT (round_id, user_id, slot) DO NOTHING;
    SELECT count INTO v_current FROM public.applause_user_contrib
     WHERE round_id = p_round AND user_id = v_user AND slot = p_slot;
    v_allowed := GREATEST(0, LEAST(p_delta, c_legacy_max - v_current));
    IF v_allowed = 0 THEN RETURN jsonb_build_object('ok', false, 'code', 'LEGACY_IGNORED'); END IF;
    UPDATE public.applause_user_contrib SET count = count + v_allowed
     WHERE round_id = p_round AND user_id = v_user AND slot = p_slot;
    INSERT INTO public.applause_counts (round_id, slot, total) VALUES (p_round, p_slot, v_allowed)
    ON CONFLICT (round_id, slot) DO UPDATE SET total = applause_counts.total + v_allowed;
    RETURN jsonb_build_object('ok', true, 'code', 'LEGACY_ACCEPTED', 'accepted', v_allowed);
  END IF;

  -- ── Duelo ──
  IF p_slot IS NULL OR p_slot NOT IN (1, 2) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_SLOT', 'error', 'Slot inválido (1 o 2)');
  END IF;
  IF p_delta IS NULL OR p_delta < 1 OR p_delta > c_max_delta THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_DELTA',
      'error', format('Cantidad inválida (1 a %s por envío)', c_max_delta), 'max_delta', c_max_delta);
  END IF;

  -- FOR SHARE: los votos se serializan contra el cierre/cancelación (que toman FOR UPDATE).
  SELECT id, session_id, game_type, status, voting_ends_at, created_at, p1_user_id, p2_user_id, tap_limit
    INTO v_r FROM public.applause_sessions WHERE id = p_round FOR SHARE;

  IF v_r.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ROUND_CANCELLED', 'error', 'La ronda fue cancelada');
  END IF;
  IF v_r.status = 'finished' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ROUND_FINISHED', 'error', 'La ronda ya terminó');
  END IF;
  IF v_r.status <> 'voting' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ROUND_NOT_VOTING', 'error', 'La votación todavía no empezó');
  END IF;
  IF v_r.voting_ends_at IS NOT NULL AND v_now >= v_r.voting_ends_at THEN
    RETURN jsonb_build_object('ok', false, 'code', 'VOTING_CLOSED', 'error', 'Se terminó el tiempo de votación');
  END IF;
  IF ((v_r.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires') - interval '6 hours')::date < v_hoy THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ROUND_EXPIRED', 'error', 'La ronda es de una jornada anterior');
  END IF;
  IF v_user = v_r.p1_user_id OR v_user = v_r.p2_user_id THEN
    RETURN jsonb_build_object('ok', false, 'code', 'DUELIST_CANNOT_VOTE', 'error', 'Los duelistas no votan');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.connected_users cu
                  WHERE cu.session_id = v_r.session_id AND cu.user_id = v_user
                    AND cu.last_seen >= v_now - c_presencia) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_PRESENT', 'error', 'Tenés que estar conectado a la sesión para aplaudir');
  END IF;

  -- Un usuario a la vez por ronda: el tope no se puede pasar con envíos en paralelo.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_round::text || ':' || v_user::text, 0));

  SELECT coalesce(sum(count), 0) INTO v_used
    FROM public.applause_user_contrib WHERE round_id = p_round AND user_id = v_user;
  v_remaining := v_r.tap_limit - v_used;
  IF v_remaining <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'LIMIT_REACHED', 'error', 'Ya usaste todos tus aplausos',
      'limit', v_r.tap_limit, 'used', v_used, 'remaining', 0);
  END IF;
  v_accepted := LEAST(p_delta, v_remaining);

  INSERT INTO public.applause_user_contrib (round_id, user_id, slot, count)
  VALUES (p_round, v_user, p_slot, v_accepted)
  ON CONFLICT (round_id, user_id, slot) DO UPDATE SET count = applause_user_contrib.count + v_accepted;

  INSERT INTO public.applause_counts (round_id, slot, total) VALUES (p_round, p_slot, v_accepted)
  ON CONFLICT (round_id, slot) DO UPDATE SET total = applause_counts.total + v_accepted;

  RETURN jsonb_build_object('ok', true, 'code', 'ACCEPTED', 'round_id', p_round, 'slot', p_slot,
    'accepted', v_accepted, 'limit', v_r.tap_limit, 'used', v_used + v_accepted,
    'remaining', v_remaining - v_accepted);
END;
$function$;

-- ═══ 9. applause_finish: Duelo delega en duelo_finish_round ════════════════
CREATE OR REPLACE FUNCTION public.applause_finish(p_round uuid, p_force boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_t1 bigint;
  v_t2 bigint;
  v_winner int;
  v_ends timestamptz;
  v_type text;
BEGIN
  SELECT game_type INTO v_type FROM public.applause_sessions WHERE id = p_round;
  IF v_type = 'duelo' THEN
    PERFORM public.duelo_finish_round(p_round, p_force);
    RETURN;
  END IF;

  -- personal_trainer / follow_leader: lógica anterior intacta.
  SELECT voting_ends_at INTO v_ends FROM public.applause_sessions WHERE id = p_round;

  IF p_force THEN
    IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()) THEN
      RETURN;
    END IF;
  ELSE
    IF v_ends IS NULL THEN RETURN; END IF;
    IF now() < v_ends THEN RETURN; END IF;
  END IF;

  UPDATE public.applause_sessions SET status = 'finished'
    WHERE id = p_round AND status = 'voting';
  IF NOT FOUND THEN RETURN; END IF;

  SELECT COALESCE((SELECT total FROM public.applause_counts WHERE round_id = p_round AND slot = 1), 0),
         COALESCE((SELECT total FROM public.applause_counts WHERE round_id = p_round AND slot = 2), 0)
    INTO v_t1, v_t2;

  v_winner := CASE
                WHEN v_t1 > v_t2 THEN 1
                WHEN v_t2 > v_t1 THEN 2
                ELSE NULL
              END;

  UPDATE public.applause_sessions SET winner_slot = v_winner WHERE id = p_round;
END;
$function$;

-- ═══ 10. EXECUTE: nada para anon ═══════════════════════════════════════════
REVOKE ALL ON FUNCTION public.duelo_launch_round(uuid, uuid, uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.duelo_finish_round(uuid, boolean)          FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.duelo_cancel_round(uuid, boolean)          FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.applause_add(uuid, integer, integer)       FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.applause_finish(uuid, boolean)             FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.duelo_launch_round(uuid, uuid, uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.duelo_finish_round(uuid, boolean)          TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.duelo_cancel_round(uuid, boolean)          TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.applause_add(uuid, integer, integer)       TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.applause_finish(uuid, boolean)             TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
