-- ─── Duelo: dos modos de votación, sin tope por persona ─────────────────────
--
-- Reemplaza los tres modos de 20261020130000:
--   'toques' → Mod 1: el público toca a uno de los dos participantes todas las
--              veces que quiera. Cuantos más toques, más % para ese lado.
--              Sin tope por persona: sólo una tanda cada 400 ms, hasta 12.
--   'votos'  → Mod 2: un único voto, a uno o al otro (se puede cambiar).
--              Ya resuelto por duelo_votar / duelo_mi_voto (20261020130000).
--   'pelea'  → se quita.
--
-- En los dos modos los totales de applause_counts son toques o votos de cada
-- lado: A = totalA / (totalA + totalB). duelo_finish_round no cambia (gana el
-- de mayor total).

-- ═══ 1. Sólo dos modos ══════════════════════════════════════════════════════
UPDATE public.duelo_reglas_config SET value = '{"modo": "toques"}'
 WHERE key = 'modo_votacion' AND value ->> 'modo' NOT IN ('toques', 'votos');

ALTER TABLE public.duelo_reglas_config DROP CONSTRAINT duelo_reglas_config_modo_valido;
ALTER TABLE public.duelo_reglas_config
  ADD CONSTRAINT duelo_reglas_config_modo_valido
    CHECK (key <> 'modo_votacion' OR
           (enabled
            AND (value - 'modo') = '{}'::jsonb
            AND (value ->> 'modo') IN ('toques', 'votos')));

-- ═══ 2. applause_add: toques sin tope por persona ══════════════════════════
-- Igual que 20261020130000 salvo: en el Duelo ya no hay tope por persona
-- (tap_limit queda sin uso) y cualquier ronda que no sea de votos se toca con
-- el ritmo de la pelea: una tanda cada 400 ms, hasta 12 toques.
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
  v_ultimo    timestamptz;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'UNAUTHORIZED', 'error', 'No autenticado');
  END IF;
  IF p_round IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_REQUEST', 'error', 'Falta la ronda');
  END IF;

  SELECT id, session_id, game_type, status, voting_ends_at, created_at, p1_user_id, p2_user_id, vote_mode
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

  SELECT id, session_id, game_type, status, voting_ends_at, created_at, p1_user_id, p2_user_id, vote_mode
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

  SELECT max(ultimo) INTO v_ultimo FROM public.applause_user_contrib
   WHERE round_id = p_round AND user_id = v_user;
  IF v_ultimo IS NOT NULL AND v_ultimo > v_now - interval '400 milliseconds' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TOO_FAST', 'error', 'Más despacio');
  END IF;
  v_accepted := LEAST(p_delta, c_max_toques);

  INSERT INTO public.applause_user_contrib (round_id, user_id, slot, count, ultimo)
  VALUES (p_round, v_user, p_slot, v_accepted, v_now)
  ON CONFLICT (round_id, user_id, slot) DO UPDATE
    SET count = applause_user_contrib.count + v_accepted, ultimo = v_now;
  INSERT INTO public.applause_counts (round_id, slot, total) VALUES (p_round, p_slot, v_accepted)
  ON CONFLICT (round_id, slot) DO UPDATE SET total = applause_counts.total + v_accepted;

  RETURN jsonb_build_object('ok', true, 'code', 'ACCEPTED', 'round_id', p_round, 'slot', p_slot,
    'accepted', v_accepted);
END;
$function$;

REVOKE ALL ON FUNCTION public.applause_add(uuid, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.applause_add(uuid, integer, integer) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
