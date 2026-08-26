-- ============================================================================
-- PANTALLA/ESCENARIO — Gestión del evento y acceso de la TV
--
-- El token de la TV vive en `pantalla_event_secrets`, que no tiene política de
-- lectura pública: sólo sale por estas RPCs. En DJ Democracy el equivalente
-- está en `events` y cualquier anónimo lo lee por REST (hallazgo C).
--
-- `pantalla_set_participant_role` es la ÚNICA vía para los roles especiales, y
-- exige admin/DJ. No existe equivalente de `guest_self_assign_role`, la RPC
-- con la que en el original un invitado se hacía VIP solo (hallazgo A).
-- ============================================================================

-- Código de 6 caracteres para el QR. Alfabeto sin O/0/I/1: se dicta en voz alta.
CREATE OR REPLACE FUNCTION public.pantalla__new_code()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE alfabeto text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; v_code text; i int;
BEGIN
  LOOP
    v_code := '';
    FOR i IN 1..6 LOOP
      v_code := v_code || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM pantalla_events WHERE code = v_code);
  END LOOP;
  RETURN v_code;
END $fn$;

CREATE OR REPLACE FUNCTION public.pantalla_create_event(_name text, _session_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  INSERT INTO pantalla_events (name, code, owner_id, session_id)
  VALUES (COALESCE(NULLIF(trim(_name),''), 'Pantalla Bizarren'),
          public.pantalla__new_code(), auth.uid(), _session_id)
  RETURNING id INTO v_id;
  INSERT INTO pantalla_event_secrets (event_id) VALUES (v_id);
  PERFORM public.pantalla_reset_vote_powers(v_id);
  RETURN v_id;
END $fn$;

-- El índice único parcial ya impide dos eventos en vivo; acá el error es legible.
CREATE OR REPLACE FUNCTION public.pantalla_start_event(_event_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_other uuid;
BEGIN
  IF NOT public.pantalla_can_manage(_event_id) THEN RAISE EXCEPTION 'not authorized'; END IF;
  SELECT id INTO v_other FROM pantalla_events WHERE status = 'live' AND id <> _event_id;
  IF v_other IS NOT NULL THEN
    RAISE EXCEPTION 'ya hay un evento en vivo; finalizalo antes de iniciar otro';
  END IF;
  UPDATE pantalla_events
     SET status = 'live', started_at = COALESCE(started_at, now()), ended_at = NULL
   WHERE id = _event_id;
  PERFORM public.pantalla_refill_candidates(_event_id);
  RETURN jsonb_build_object('ok', true);
END $fn$;

CREATE OR REPLACE FUNCTION public.pantalla_end_event(_event_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NOT public.pantalla_can_manage(_event_id) THEN RAISE EXCEPTION 'not authorized'; END IF;
  UPDATE pantalla_events
     SET status = 'ended', ended_at = now(), is_playing = false, current_item_id = NULL
   WHERE id = _event_id;
  RETURN jsonb_build_object('ok', true);
END $fn$;

-- Destructivo, pero acotado al evento: no toca ninguna tabla previa de BizarrApp.
CREATE OR REPLACE FUNCTION public.pantalla_reset_event(_event_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NOT public.pantalla_can_manage(_event_id) THEN RAISE EXCEPTION 'not authorized'; END IF;
  UPDATE pantalla_events SET current_item_id = NULL, is_playing = false,
    voting_frozen = false, voting_disabled = false, frozen_ranking = NULL,
    current_started_at = NULL, tv_current_time = NULL, tv_duration = NULL
   WHERE id = _event_id;
  DELETE FROM pantalla_votes        WHERE event_id = _event_id;
  DELETE FROM pantalla_kick_votes   WHERE event_id = _event_id;
  DELETE FROM pantalla_reactions    WHERE event_id = _event_id;
  DELETE FROM pantalla_play_history WHERE event_id = _event_id;
  DELETE FROM pantalla_participants WHERE event_id = _event_id;
  UPDATE pantalla_playlist_items SET
    is_active_candidate = false, pos_votes = 0, neg_votes = 0, score = 0,
    times_played = 0, last_status = 'idle', last_status_changed_at = now(),
    consecutive_last_place_rounds = 0, hot_until = NULL
   WHERE event_id = _event_id;
  PERFORM public.pantalla_refill_candidates(_event_id);
  RETURN jsonb_build_object('ok', true);
END $fn$;

CREATE OR REPLACE FUNCTION public.pantalla_reset_votes(_event_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NOT public.pantalla_can_manage(_event_id) THEN RAISE EXCEPTION 'not authorized'; END IF;
  DELETE FROM pantalla_votes WHERE event_id = _event_id;
  UPDATE pantalla_playlist_items SET pos_votes = 0, neg_votes = 0, score = 0
   WHERE event_id = _event_id;
  UPDATE pantalla_participants SET super_votes_used = 0 WHERE event_id = _event_id;
  RETURN jsonb_build_object('ok', true);
END $fn$;

-- Congela el ORDEN mostrado (snapshot), no la escritura: mismo comportamiento
-- que el original, donde el voto sigue entrando con el ranking congelado.
CREATE OR REPLACE FUNCTION public.pantalla_freeze_voting(_event_id uuid, _frozen boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_snapshot jsonb;
BEGIN
  IF NOT public.pantalla_can_manage(_event_id) THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF _frozen THEN
    SELECT jsonb_agg(id ORDER BY score DESC, position ASC) INTO v_snapshot
      FROM pantalla_playlist_items WHERE event_id = _event_id AND is_active_candidate;
    UPDATE pantalla_events SET voting_frozen = true, frozen_ranking = v_snapshot WHERE id = _event_id;
  ELSE
    UPDATE pantalla_events SET voting_frozen = false, frozen_ranking = NULL WHERE id = _event_id;
  END IF;
  RETURN jsonb_build_object('ok', true, 'frozen', _frozen);
END $fn$;

CREATE OR REPLACE FUNCTION public.pantalla_set_participant_role(_event_id uuid, _user_id uuid, _role text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NOT public.pantalla_can_manage(_event_id) THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF _role NOT IN ('guest','vip','birthday','staff') THEN RAISE EXCEPTION 'invalid role'; END IF;
  UPDATE pantalla_participants SET role = _role
   WHERE event_id = _event_id AND user_id = _user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'participant not found'; END IF;
  RETURN jsonb_build_object('ok', true, 'role', _role);
END $fn$;

CREATE OR REPLACE FUNCTION public.pantalla_remove_participant(_event_id uuid, _user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NOT public.pantalla_can_manage(_event_id) THEN RAISE EXCEPTION 'not authorized'; END IF;
  DELETE FROM pantalla_votes        WHERE event_id = _event_id AND user_id = _user_id;
  DELETE FROM pantalla_kick_votes   WHERE event_id = _event_id AND user_id = _user_id;
  DELETE FROM pantalla_participants WHERE event_id = _event_id AND user_id = _user_id;
  RETURN jsonb_build_object('ok', true);
END $fn$;


-- ── Acceso de la TV ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.pantalla_get_tv_link(_event_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_code text; v_token text;
BEGIN
  IF NOT public.pantalla_can_manage(_event_id) THEN RAISE EXCEPTION 'not authorized'; END IF;
  SELECT e.code, s.tv_access_token INTO v_code, v_token
    FROM pantalla_events e LEFT JOIN pantalla_event_secrets s ON s.event_id = e.id
   WHERE e.id = _event_id;
  IF v_token IS NULL THEN
    INSERT INTO pantalla_event_secrets (event_id) VALUES (_event_id)
      ON CONFLICT (event_id) DO NOTHING;
    SELECT tv_access_token INTO v_token FROM pantalla_event_secrets WHERE event_id = _event_id;
  END IF;
  RETURN jsonb_build_object('code', v_code, 'token', v_token);
END $fn$;

CREATE OR REPLACE FUNCTION public.pantalla_regenerate_tv_token(_event_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_token text;
BEGIN
  IF NOT public.pantalla_can_manage(_event_id) THEN RAISE EXCEPTION 'not authorized'; END IF;
  INSERT INTO pantalla_event_secrets (event_id) VALUES (_event_id)
    ON CONFLICT (event_id) DO UPDATE
    SET tv_access_token = encode(extensions.gen_random_bytes(24), 'hex'), rotated_at = now()
  RETURNING tv_access_token INTO v_token;
  RETURN jsonb_build_object('token', v_token);
END $fn$;

-- Única vía para que la TV sin sesión sepa sobre qué evento trabaja.
CREATE OR REPLACE FUNCTION public.pantalla_resolve_tv(_code text, _token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_id uuid; v_name text;
BEGIN
  SELECT e.id, e.name INTO v_id, v_name
    FROM pantalla_events e JOIN pantalla_event_secrets s ON s.event_id = e.id
   WHERE upper(e.code) = upper(trim(_code)) AND s.tv_access_token = _token;
  IF v_id IS NULL THEN RAISE EXCEPTION 'invalid tv access'; END IF;
  RETURN jsonb_build_object('event_id', v_id, 'name', v_name);
END $fn$;

CREATE OR REPLACE FUNCTION public.pantalla__tv_authorized(_event_id uuid, _token text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT public.pantalla_can_manage(_event_id)
      OR EXISTS (SELECT 1 FROM pantalla_event_secrets s
                 WHERE s.event_id = _event_id AND _token IS NOT NULL AND s.tv_access_token = _token);
$fn$;

CREATE OR REPLACE FUNCTION public.pantalla_tv_report(
  _event_id uuid, _token text, _current_time numeric, _duration numeric
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NOT public.pantalla__tv_authorized(_event_id, _token) THEN RAISE EXCEPTION 'invalid tv access'; END IF;
  UPDATE pantalla_events SET tv_current_time = _current_time, tv_duration = _duration,
    tv_connected_at = now() WHERE id = _event_id;
END $fn$;

-- La TV es el motor de reproducción: cuando el video termina, ella pide el
-- avance. `_item_id` funciona de guard contra un avance simultáneo del DJ.
CREATE OR REPLACE FUNCTION public.pantalla_tv_song_ended(
  _event_id uuid, _token text, _item_id uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NOT public.pantalla__tv_authorized(_event_id, _token) THEN RAISE EXCEPTION 'invalid tv access'; END IF;
  RETURN public.pantalla__advance(_event_id, NULL, _item_id, 'advance');
END $fn$;
