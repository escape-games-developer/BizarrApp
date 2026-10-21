-- ─── Duelo de Talentos: tres modos de votación (como Follow the Leader) ──────
--
-- Regla nueva en duelo_reglas_config, key='modo_votacion', value {"modo": …}:
--   'toques' → Mod 1: aplausómetro. Toques a cualquiera de los dos, con tope
--              por persona (max_aplausos_usuario). % = parte de cada uno.
--   'votos'  → Mod 2: un voto fijo por persona, P1 o P2 (se puede cambiar).
--              % = parte de los votos.
--   'pelea'  → Mod 3: toques sin tope que pelean la barra. Arranca en 50 % y
--              se mueve `pelea_paso` puntos por cada toque NETO (P1 − P2).
--
-- La ronda congela su modo y su paso al crearse (trigger sobre
-- applause_sessions): cambiar la regla aplica desde el próximo lanzamiento.
--
-- En los tres modos los totales viven en applause_counts (toques o votos), así
-- que duelo_finish_round no cambia: en la pelea la barra queda del lado de
-- quien tiene más toques, y ése es el ganador.

-- ═══ 1. Regla modo_votacion ═════════════════════════════════════════════════
ALTER TABLE public.duelo_reglas_config DROP CONSTRAINT duelo_reglas_config_key_valida;
ALTER TABLE public.duelo_reglas_config
  ADD CONSTRAINT duelo_reglas_config_key_valida
    CHECK (key IN ('duracion_votacion', 'max_aplausos_usuario', 'modo_votacion')),
  ADD CONSTRAINT duelo_reglas_config_modo_valido
    CHECK (key <> 'modo_votacion' OR
           (enabled
            AND (value - 'modo') = '{}'::jsonb
            AND (value ->> 'modo') IN ('toques', 'votos', 'pelea')));

INSERT INTO public.duelo_reglas_config (key, enabled, value)
VALUES ('modo_votacion', true, '{"modo": "toques"}')
ON CONFLICT (key) DO NOTHING;

-- ═══ 2. La ronda congela modo y paso ═══════════════════════════════════════
ALTER TABLE public.applause_sessions
  ADD COLUMN vote_mode  text,
  ADD COLUMN pelea_paso double precision,
  ADD CONSTRAINT applause_sessions_vote_mode_check
    CHECK (vote_mode IS NULL OR vote_mode IN ('toques', 'votos', 'pelea'));

-- Throttle de la pelea: última tanda aceptada por persona y slot.
ALTER TABLE public.applause_user_contrib
  ADD COLUMN ultimo timestamptz;

CREATE FUNCTION public.duelo_ronda_modo()
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
  -- Mismo paso que la pelea de FTL: con 20 conectados, 40 toques netos llevan
  -- la barra del medio a un extremo.
  SELECT count(*) INTO v_conectados FROM public.connected_users
   WHERE session_id = NEW.session_id AND last_seen > now() - interval '90 seconds';
  NEW.pelea_paso := 50.0 / greatest(15, 2 * v_conectados);
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.duelo_ronda_modo() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER duelo_ronda_modo
  BEFORE INSERT ON public.applause_sessions
  FOR EACH ROW EXECUTE FUNCTION public.duelo_ronda_modo();

-- ═══ 3. applause_add: toques (Mod 1) y pelea (Mod 3) ══════════════════════
-- Igual que 20260930005253 salvo: rechaza las rondas en modo 'votos'
-- (WRONG_MODE) y en 'pelea' no hay tope por persona sino una tanda cada
-- 400 ms de hasta 12 toques (TOO_FAST si llega antes).
CREATE OR REPLACE FUNCTION public.applause_add(p_round uuid, p_slot integer, p_delta integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  c_max_delta  constant int      := 50;
  c_max_pelea  constant int      := 12;
  c_presencia  constant interval := interval '2 minutes';
  c_legacy_max constant int      := 300;
  v_now       timestamptz := now();
  v_hoy       date := ((v_now AT TIME ZONE 'America/Argentina/Buenos_Aires') - interval '6 hours')::date;
  v_user      uuid := auth.uid();
  v_r         record;
  v_used      int;
  v_remaining int;
  v_accepted  int;
  v_current   int;
  v_allowed   int;
  v_ultimo    timestamptz;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'UNAUTHORIZED', 'error', 'No autenticado');
  END IF;
  IF p_round IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_REQUEST', 'error', 'Falta la ronda');
  END IF;

  SELECT id, session_id, game_type, status, voting_ends_at, created_at, p1_user_id, p2_user_id, tap_limit, vote_mode
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
  IF coalesce(v_r.vote_mode, 'toques') = 'votos' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'WRONG_MODE', 'error', 'Esta ronda se vota con un voto fijo');
  END IF;
  IF p_slot IS NULL OR p_slot NOT IN (1, 2) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_SLOT', 'error', 'Slot inválido (1 o 2)');
  END IF;
  IF p_delta IS NULL OR p_delta < 1 OR p_delta > c_max_delta THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_DELTA',
      'error', format('Cantidad inválida (1 a %s por envío)', c_max_delta), 'max_delta', c_max_delta);
  END IF;

  SELECT id, session_id, game_type, status, voting_ends_at, created_at, p1_user_id, p2_user_id, tap_limit, vote_mode
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

  PERFORM pg_advisory_xact_lock(hashtextextended(p_round::text || ':' || v_user::text, 0));

  -- ── Mod 3 · pelea: sin tope, una tanda cada 400 ms ──
  IF v_r.vote_mode = 'pelea' THEN
    SELECT max(ultimo) INTO v_ultimo FROM public.applause_user_contrib
     WHERE round_id = p_round AND user_id = v_user;
    IF v_ultimo IS NOT NULL AND v_ultimo > v_now - interval '400 milliseconds' THEN
      RETURN jsonb_build_object('ok', false, 'code', 'TOO_FAST', 'error', 'Más despacio');
    END IF;
    v_accepted := LEAST(p_delta, c_max_pelea);
    INSERT INTO public.applause_user_contrib (round_id, user_id, slot, count, ultimo)
    VALUES (p_round, v_user, p_slot, v_accepted, v_now)
    ON CONFLICT (round_id, user_id, slot) DO UPDATE
      SET count = applause_user_contrib.count + v_accepted, ultimo = v_now;
    INSERT INTO public.applause_counts (round_id, slot, total) VALUES (p_round, p_slot, v_accepted)
    ON CONFLICT (round_id, slot) DO UPDATE SET total = applause_counts.total + v_accepted;
    RETURN jsonb_build_object('ok', true, 'code', 'ACCEPTED', 'round_id', p_round, 'slot', p_slot,
      'accepted', v_accepted, 'limit', NULL, 'used', NULL, 'remaining', NULL);
  END IF;

  -- ── Mod 1 · toques: tope por persona ──
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

-- ═══ 4. Mod 2 · voto fijo ══════════════════════════════════════════════════
-- Un voto por persona y ronda. Votar al otro lo mueve: resta de un lado y
-- suma del otro en la misma transacción.
CREATE FUNCTION public.duelo_votar(p_round uuid, p_slot integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  c_presencia constant interval := interval '2 minutes';
  v_now   timestamptz := now();
  v_hoy   date := ((v_now AT TIME ZONE 'America/Argentina/Buenos_Aires') - interval '6 hours')::date;
  v_user  uuid := auth.uid();
  v_r     record;
  v_prev  int;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'UNAUTHORIZED', 'error', 'No autenticado');
  END IF;
  IF p_round IS NULL OR p_slot IS NULL OR p_slot NOT IN (1, 2) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_SLOT', 'error', 'Slot inválido (1 o 2)');
  END IF;

  SELECT * INTO v_r FROM public.applause_sessions WHERE id = p_round FOR SHARE;
  IF NOT FOUND OR v_r.game_type <> 'duelo' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ROUND_NOT_FOUND', 'error', 'La ronda no existe');
  END IF;
  IF coalesce(v_r.vote_mode, 'toques') <> 'votos' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'WRONG_MODE', 'error', 'Esta ronda se vota con toques');
  END IF;
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

  SELECT slot INTO v_prev FROM public.applause_user_contrib
   WHERE round_id = p_round AND user_id = v_user AND count > 0 LIMIT 1;
  IF v_prev = p_slot THEN
    RETURN jsonb_build_object('ok', true, 'code', 'VOTED', 'slot', p_slot);
  END IF;
  IF v_prev IS NOT NULL THEN
    UPDATE public.applause_user_contrib SET count = 0
     WHERE round_id = p_round AND user_id = v_user AND slot = v_prev;
    UPDATE public.applause_counts SET total = GREATEST(0, total - 1)
     WHERE round_id = p_round AND slot = v_prev;
  END IF;

  INSERT INTO public.applause_user_contrib (round_id, user_id, slot, count)
  VALUES (p_round, v_user, p_slot, 1)
  ON CONFLICT (round_id, user_id, slot) DO UPDATE SET count = 1;
  INSERT INTO public.applause_counts (round_id, slot, total) VALUES (p_round, p_slot, 1)
  ON CONFLICT (round_id, slot) DO UPDATE SET total = applause_counts.total + 1;

  RETURN jsonb_build_object('ok', true, 'code', 'VOTED', 'slot', p_slot, 'previous_slot', v_prev);
END;
$function$;

-- Mi voto en la ronda (applause_user_contrib sólo la lee el admin).
CREATE FUNCTION public.duelo_mi_voto(p_round uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT slot FROM public.applause_user_contrib
   WHERE round_id = p_round AND user_id = auth.uid() AND count > 0
   LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.applause_add(uuid, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.duelo_votar(uuid, integer)           FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.duelo_mi_voto(uuid)                  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.applause_add(uuid, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.duelo_votar(uuid, integer)           TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.duelo_mi_voto(uuid)                  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
