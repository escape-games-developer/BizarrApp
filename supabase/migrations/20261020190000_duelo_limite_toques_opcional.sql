-- ─── Duelo: límite de toques por persona, activable ─────────────────────────
--
-- Regla max_aplausos_usuario (Mod 1 · Por toques):
--   enabled = true  → cada persona tiene `max` toques por ronda (entre los dos
--                     participantes)
--   enabled = false → toques continuos e indefinidos (sólo se frena el ritmo:
--                     una tanda cada 400 ms, hasta 12)
-- Apagada conserva el número, como la duración de la votación.
--
-- La ronda congela su tope al crearse: el trigger duelo_ronda_modo pone
-- tap_limit = NULL si la regla está apagada. Mod 2 (voto único) no usa tope.

-- ═══ 1. La regla se puede apagar ═══════════════════════════════════════════
ALTER TABLE public.duelo_reglas_config DROP CONSTRAINT duelo_reglas_config_max_aplausos_valido;
ALTER TABLE public.duelo_reglas_config
  ADD CONSTRAINT duelo_reglas_config_max_aplausos_valido
    CHECK (key <> 'max_aplausos_usuario' OR
           CASE WHEN jsonb_typeof(value -> 'max') = 'number'
                     AND (value - 'max') = '{}'::jsonb
                     AND (value ->> 'max') ~ '^[1-9][0-9]*$'
                THEN (value ->> 'max')::int BETWEEN 10 AND 1000
                ELSE false END);

-- ═══ 2. Rondas de Duelo sin tope ═══════════════════════════════════════════
-- Igual que 20260930005253 salvo que tap_limit puede ser NULL (sin tope).
ALTER TABLE public.applause_sessions DROP CONSTRAINT applause_sessions_duelo_consistente;
ALTER TABLE public.applause_sessions
  ADD CONSTRAINT applause_sessions_duelo_consistente
    CHECK (game_type <> 'duelo'
           OR (p1_user_id IS NOT NULL AND p2_user_id IS NOT NULL
               AND p1_user_id <> p2_user_id
               AND (status <> 'finished'
                    OR (finished_at IS NOT NULL AND cancel_reason IS NULL
                        AND ((result = 'p1'  AND winner_slot = 1)
                          OR (result = 'p2'  AND winner_slot = 2)
                          OR (result = 'tie' AND winner_slot IS NULL))))));

CREATE OR REPLACE FUNCTION public.duelo_ronda_modo()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_conectados int;
BEGIN
  IF NEW.game_type <> 'duelo' THEN RETURN NEW; END IF;
  NEW.vote_mode := coalesce(
    (SELECT value ->> 'modo' FROM public.duelo_reglas_config WHERE key = 'modo_votacion'),
    'toques');
  -- Límite de toques apagado → sin tope.
  IF NOT coalesce((SELECT enabled FROM public.duelo_reglas_config WHERE key = 'max_aplausos_usuario'), true) THEN
    NEW.tap_limit := NULL;
  END IF;
  SELECT count(*) INTO v_conectados FROM public.connected_users
   WHERE session_id = NEW.session_id AND last_seen > now() - interval '90 seconds';
  NEW.pelea_paso := 50.0 / greatest(15, 2 * v_conectados);
  RETURN NEW;
END;
$function$;

-- ═══ 3. applause_add: tope opcional ════════════════════════════════════════
-- Igual que 20261020170000 salvo: si la ronda tiene tap_limit, nadie pasa de
-- ese total (sumando a los dos participantes); devuelve used / remaining.
CREATE OR REPLACE FUNCTION public.applause_add(p_round uuid, p_slot integer, p_delta integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  c_max_toques constant int      := 12;
  c_presencia  constant interval := interval '2 minutes';
  c_legacy_max constant int      := 300;
  v_now       timestamptz := now();
  v_hoy       date := ((v_now AT TIME ZONE 'America/Argentina/Buenos_Aires') - interval '6 hours')::date;
  v_user      uuid := auth.uid();
  v_r         record;
  v_accepted  int;
  v_current   int;
  v_allowed   int;
  v_used      int;
  v_ultimo    timestamptz;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'UNAUTHORIZED', 'error', 'No autenticado');
  END IF;
  IF p_round IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_REQUEST', 'error', 'Falta la ronda');
  END IF;

  SELECT id, session_id, game_type, status, voting_ends_at, created_at, p1_user_id, p2_user_id, vote_mode, tap_limit
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

  -- ── Duelo · Mod 1 (toques) ──
  IF coalesce(v_r.vote_mode, 'toques') = 'votos' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'WRONG_MODE', 'error', 'Esta ronda se vota con un voto único');
  END IF;
  IF p_slot IS NULL OR p_slot NOT IN (1, 2) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_SLOT', 'error', 'Slot inválido (1 o 2)');
  END IF;
  IF p_delta IS NULL OR p_delta < 1 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_DELTA', 'error', 'Cantidad inválida');
  END IF;

  SELECT id, session_id, game_type, status, voting_ends_at, created_at, p1_user_id, p2_user_id, vote_mode, tap_limit
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
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_PRESENT', 'error', 'Tenés que estar conectado a la sesión para votar');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_round::text || ':' || v_user::text, 0));

  SELECT max(ultimo), coalesce(sum(count), 0) INTO v_ultimo, v_used
    FROM public.applause_user_contrib WHERE round_id = p_round AND user_id = v_user;
  IF v_ultimo IS NOT NULL AND v_ultimo > v_now - interval '400 milliseconds' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TOO_FAST', 'error', 'Más despacio');
  END IF;

  v_accepted := LEAST(p_delta, c_max_toques);
  IF v_r.tap_limit IS NOT NULL THEN
    IF v_used >= v_r.tap_limit THEN
      RETURN jsonb_build_object('ok', false, 'code', 'LIMIT_REACHED', 'error', 'Ya usaste todos tus toques',
        'limit', v_r.tap_limit, 'used', v_used, 'remaining', 0);
    END IF;
    v_accepted := LEAST(v_accepted, v_r.tap_limit - v_used);
  END IF;

  INSERT INTO public.applause_user_contrib (round_id, user_id, slot, count, ultimo)
  VALUES (p_round, v_user, p_slot, v_accepted, v_now)
  ON CONFLICT (round_id, user_id, slot) DO UPDATE
    SET count = applause_user_contrib.count + v_accepted, ultimo = v_now;
  INSERT INTO public.applause_counts (round_id, slot, total) VALUES (p_round, p_slot, v_accepted)
  ON CONFLICT (round_id, slot) DO UPDATE SET total = applause_counts.total + v_accepted;

  RETURN jsonb_build_object('ok', true, 'code', 'ACCEPTED', 'round_id', p_round, 'slot', p_slot,
    'accepted', v_accepted, 'limit', v_r.tap_limit, 'used', v_used + v_accepted,
    'remaining', CASE WHEN v_r.tap_limit IS NOT NULL THEN v_r.tap_limit - v_used - v_accepted END);
END;
$function$;

REVOKE ALL ON FUNCTION public.applause_add(uuid, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.applause_add(uuid, integer, integer) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
