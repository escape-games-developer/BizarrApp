-- Duelo de Talentos: regla «un participante de cada team».
-- * Nueva fila `un_por_team` en duelo_reglas_config (apagada por defecto):
--   prendida, el duelo tiene que ser Membrillo contra Batata.
-- * La hace cumplir `duelo_launch_round` (autoridad), además del panel: con la
--   regla prendida, los dos tienen que tener team y ser de teams distintos.
--   El team sale de `profiles` (las postulaciones no lo guardan).

alter table public.duelo_reglas_config drop constraint if exists duelo_reglas_config_key_valida;
alter table public.duelo_reglas_config add constraint duelo_reglas_config_key_valida
  check (key = any (array['duracion_votacion', 'max_aplausos_usuario', 'modo_votacion', 'video_fondo', 'un_por_team']));
alter table public.duelo_reglas_config add constraint duelo_reglas_config_un_por_team_valida
  check (key <> 'un_por_team' or value = '{}'::jsonb);

insert into public.duelo_reglas_config (key, enabled, value)
values ('un_por_team', false, '{}'::jsonb)
on conflict (key) do nothing;

CREATE OR REPLACE FUNCTION public.duelo_launch_round(p_session uuid, p_postulacion_1 uuid, p_postulacion_2 uuid, p_video jsonb DEFAULT NULL::jsonb)
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
  v_team1    text;
  v_team2    text;
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

  -- Regla «un participante de cada team».
  IF EXISTS (SELECT 1 FROM public.duelo_reglas_config WHERE key = 'un_por_team' AND enabled) THEN
    SELECT team INTO v_team1 FROM public.profiles WHERE id = v_p1.user_id;
    SELECT team INTO v_team2 FROM public.profiles WHERE id = v_p2.user_id;
    IF v_team1 IS NULL OR v_team2 IS NULL OR v_team1 = v_team2 THEN
      RETURN jsonb_build_object('ok', false, 'code', 'TEAMS_RULE',
        'error', 'Con la regla «uno de cada team» activa, el duelo tiene que ser Membrillo contra Batata');
    END IF;
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

notify pgrst, 'reload schema';
