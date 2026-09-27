-- Rey del Orto V1 · Cancelación transaccional de ronda (fallo tardío)
-- - game_state.raffle_state admite 'cancelled'
-- - game_state.raffle_cancel jsonb con el motivo estructurado
-- - rey_cancelar_ronda: contención (sólo launched → cancelled; nunca degrada winner)
-- - rey_resolver_sorteo: rechazos operativos sobre una ronda launched la cancelan
--   en la MISMA transacción; idempotencia already_cancelled / already_drawn.

-- 1) raffle_state: reemplazar el CHECK existente (detectado por definición, no por nombre)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.conname
      FROM pg_constraint c
     WHERE c.conrelid = 'public.game_state'::regclass
       AND c.contype  = 'c'
       AND pg_get_constraintdef(c.oid) ILIKE '%raffle_state%'
  LOOP
    EXECUTE format('ALTER TABLE public.game_state DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.game_state
  ADD CONSTRAINT game_state_raffle_state_check
  CHECK (raffle_state = ANY (ARRAY['idle'::text, 'launched'::text, 'winner'::text, 'cancelled'::text]));

-- 2) raffle_cancel
ALTER TABLE public.game_state
  ADD COLUMN IF NOT EXISTS raffle_cancel jsonb;

ALTER TABLE public.game_state
  ADD CONSTRAINT game_state_raffle_cancel_required
  CHECK (raffle_state <> 'cancelled' OR raffle_cancel IS NOT NULL);

COMMENT ON COLUMN public.game_state.raffle_cancel IS
  'Rey del Orto: motivo estructurado de la última ronda cancelada ({code, connected_count, eligible_count, required_count, at}). Obligatorio si raffle_state = cancelled. Se limpia al publicar ganador.';

-- 3) Contención: cancelar una ronda que sigue launched
CREATE OR REPLACE FUNCTION public.rey_cancelar_ronda(
  p_session_id uuid,
  p_cancel     jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_gs     record;
  v_cancel jsonb;
  v_winner jsonb;
BEGIN
  IF p_session_id IS NULL
     OR p_cancel IS NULL
     OR jsonb_typeof(p_cancel) IS DISTINCT FROM 'object'
     OR jsonb_typeof(p_cancel -> 'code') IS DISTINCT FROM 'string'
     OR (p_cancel ->> 'code') !~ '^[A-Z][A-Z0-9_]{2,63}$' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_REQUEST');
  END IF;

  SELECT gs.raffle_state, gs.raffle_cancel, gs.raffle_winner_id, gs.raffle_winner_name, gs.raffle_prize
    INTO v_gs
    FROM public.game_state gs
   WHERE gs.session_id = p_session_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ROUND_NOT_FOUND');
  END IF;

  -- Nunca degradar un ganador publicado.
  IF v_gs.raffle_state = 'winner' THEN
    IF v_gs.raffle_winner_id IS NOT NULL THEN
      SELECT jsonb_build_object('user_id', cu.user_id, 'name', cu.name, 'team', cu.team,
                                'avatar_id', cu.avatar_id, 'avatar_emoji', cu.avatar_emoji)
        INTO v_winner
        FROM public.connected_users cu
       WHERE cu.session_id = p_session_id
         AND cu.user_id    = v_gs.raffle_winner_id;
      v_winner := coalesce(v_winner,
                           jsonb_build_object('user_id', v_gs.raffle_winner_id, 'name', v_gs.raffle_winner_name));
    END IF;
    RETURN jsonb_build_object('ok', false, 'code', 'ROUND_ALREADY_DRAWN', 'cancelled', false,
                              'already_drawn', true, 'winner', v_winner, 'prize', v_gs.raffle_prize);
  END IF;

  -- Ya cancelada: no-op, se conserva el motivo original.
  IF v_gs.raffle_state = 'cancelled' THEN
    RETURN jsonb_build_object('ok', true, 'cancelled', false, 'already_cancelled', true,
                              'cancel', v_gs.raffle_cancel);
  END IF;

  IF v_gs.raffle_state IS DISTINCT FROM 'launched' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ROUND_NOT_LAUNCHED', 'cancelled', false);
  END IF;

  v_cancel := p_cancel || jsonb_build_object('at', now());

  UPDATE public.game_state
     SET raffle_state  = 'cancelled',
         raffle_cancel = v_cancel
   WHERE session_id   = p_session_id
     AND raffle_state = 'launched';

  RETURN jsonb_build_object('ok', true, 'cancelled', true, 'already_cancelled', false,
                            'cancel', v_cancel);
END;
$$;

COMMENT ON FUNCTION public.rey_cancelar_ronda(uuid, jsonb) IS
  'Rey del Orto V1: cancela una ronda SOLO si raffle_state = launched (→ cancelled + raffle_cancel). winner nunca se degrada; cancelled es no-op idempotente. No toca rey_ganadores. Sólo service_role.';

REVOKE ALL ON FUNCTION public.rey_cancelar_ronda(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rey_cancelar_ronda(uuid, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.rey_cancelar_ronda(uuid, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rey_cancelar_ronda(uuid, jsonb) TO service_role;

-- 4) rey_resolver_sorteo con cancelación transaccional e idempotencia already_cancelled
CREATE OR REPLACE FUNCTION public.rey_resolver_sorteo(
  p_session_id uuid,
  p_prize      text    DEFAULT NULL,
  p_dry_run    boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  c_presence   constant interval := interval '2 minutes';           -- misma ventana que launch-raffle v6
  v_now        timestamptz := now();                                -- = transaction_timestamp(): fijo en toda la transacción
  v_jornada    date := ((v_now AT TIME ZONE 'America/Argentina/Buenos_Aires') - interval '6 hours')::date;
  v_dry        boolean := coalesce(p_dry_run, false);
  v_gs         record;
  v_min_found  boolean;
  v_min_on     boolean;
  v_min_value  jsonb;
  v_required   int;
  v_blk_found  boolean;
  v_blk_on     boolean;
  v_conn_ids   uuid[];
  v_elig_ids   uuid[];
  v_connected  int;
  v_eligible   int;
  v_prize      text;
  v_w          record;
  v_victoria   smallint;
  v_rows       int;
  v_winner     jsonb;
  v_reject     jsonb;
  v_cancel     jsonb;
BEGIN
  IF p_session_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_REQUEST', 'dry_run', v_dry);
  END IF;

  -- 1) Ronda. Resolución real: lock de la fila (serializa lanzamientos concurrentes).
  --    Dry-run: lectura simple, sin lock, sin escrituras.
  IF v_dry THEN
    SELECT gs.raffle_state, gs.raffle_winner_id, gs.raffle_winner_name, gs.raffle_prize, gs.raffle_cancel
      INTO v_gs
      FROM public.game_state gs
     WHERE gs.session_id = p_session_id;
  ELSE
    SELECT gs.raffle_state, gs.raffle_winner_id, gs.raffle_winner_name, gs.raffle_prize, gs.raffle_cancel
      INTO v_gs
      FROM public.game_state gs
     WHERE gs.session_id = p_session_id
       FOR UPDATE;
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ROUND_NOT_FOUND', 'dry_run', v_dry);
  END IF;

  IF NOT v_dry THEN
    -- Idempotencia: ronda ya resuelta → mismo ganador persistido.
    IF v_gs.raffle_state = 'winner' THEN
      IF v_gs.raffle_winner_id IS NOT NULL THEN
        SELECT jsonb_build_object('user_id', cu.user_id, 'name', cu.name, 'team', cu.team,
                                  'avatar_id', cu.avatar_id, 'avatar_emoji', cu.avatar_emoji)
          INTO v_winner
          FROM public.connected_users cu
         WHERE cu.session_id = p_session_id
           AND cu.user_id    = v_gs.raffle_winner_id;
        v_winner := coalesce(v_winner,
                             jsonb_build_object('user_id', v_gs.raffle_winner_id, 'name', v_gs.raffle_winner_name));
      END IF;
      RETURN jsonb_build_object('ok', true, 'dry_run', false, 'already_drawn', true,
                                'winner', v_winner, 'prize', v_gs.raffle_prize);
    END IF;

    -- Idempotencia: ronda ya cancelada → mismo rechazo original.
    IF v_gs.raffle_state = 'cancelled' THEN
      RETURN jsonb_build_object('ok', false, 'dry_run', false,
                                'already_cancelled', true, 'cancelled', false,
                                'code',            v_gs.raffle_cancel ->> 'code',
                                'connected_count', v_gs.raffle_cancel -> 'connected_count',
                                'eligible_count',  v_gs.raffle_cancel -> 'eligible_count',
                                'required_count',  v_gs.raffle_cancel -> 'required_count',
                                'cancel',          v_gs.raffle_cancel);
    END IF;

    IF v_gs.raffle_state IS DISTINCT FROM 'launched' THEN
      RETURN jsonb_build_object('ok', false, 'code', 'ROUND_NOT_LAUNCHED', 'dry_run', false);
    END IF;

    -- A partir de acá la ronda está launched y bloqueada: todo rechazo operativo la cancela.
    v_prize := nullif(btrim(p_prize), '');
    IF v_prize IS NULL THEN
      v_reject := jsonb_build_object('code', 'INVALID_PRIZE');
      v_cancel := public.rey_cancelar_ronda(p_session_id, v_reject);
      RETURN v_reject || jsonb_build_object('ok', false, 'dry_run', false,
               'cancelled', coalesce((v_cancel ->> 'cancelled')::boolean, false),
               'already_cancelled', false, 'cancel', v_cancel -> 'cancel');
    END IF;
  END IF;

  -- 2) Configuración (búsqueda por key; sin defaults silenciosos)
  SELECT true, rc.enabled, rc.value
    INTO v_min_found, v_min_on, v_min_value
    FROM public.rey_reglas_config rc
   WHERE rc.key = 'participantes_minimos';

  SELECT true, rc.enabled
    INTO v_blk_found, v_blk_on
    FROM public.rey_reglas_config rc
   WHERE rc.key = 'bloquear_ganadores_repetidos';

  IF v_min_found IS NOT TRUE OR v_blk_found IS NOT TRUE
     OR (v_min_on AND (jsonb_typeof(v_min_value -> 'min') IS DISTINCT FROM 'number'
                       OR (v_min_value ->> 'min') !~ '^[1-9][0-9]*$')) THEN
    v_reject := jsonb_build_object('code', 'RAFFLE_CONFIG_INCOMPLETE');
    IF v_dry THEN
      RETURN v_reject || jsonb_build_object('ok', false, 'dry_run', true);
    END IF;
    v_cancel := public.rey_cancelar_ronda(p_session_id, v_reject);
    RETURN v_reject || jsonb_build_object('ok', false, 'dry_run', false,
             'cancelled', coalesce((v_cancel ->> 'cancelled')::boolean, false),
             'already_cancelled', false, 'cancel', v_cancel -> 'cancel');
  END IF;

  IF v_min_on THEN
    v_required := (v_min_value ->> 'min')::int;
  END IF;

  -- 3) Conectados reales: misma presencia que launch-raffle v6 (sesión + last_seen en los últimos 2 min)
  SELECT array_agg(cu.user_id)
    INTO v_conn_ids
    FROM public.connected_users cu
   WHERE cu.session_id = p_session_id
     AND cu.last_seen >= v_now - c_presence;
  v_connected := coalesce(cardinality(v_conn_ids), 0);

  -- 4) Elegibles: conectados − (ganadores de la jornada, sólo si la regla está ON)
  SELECT array_agg(u.user_id)
    INTO v_elig_ids
    FROM unnest(coalesce(v_conn_ids, '{}'::uuid[])) AS u(user_id)
   WHERE NOT (v_blk_on AND EXISTS (
           SELECT 1 FROM public.rey_ganadores g
            WHERE g.jornada = v_jornada
              AND g.user_id = u.user_id));
  v_eligible := coalesce(cardinality(v_elig_ids), 0);

  -- 5) Mínimo configurable / 6) Bolsa vacía
  IF v_min_on AND v_connected < v_required THEN
    v_reject := jsonb_build_object('code', 'MIN_PARTICIPANTS',
                                   'connected_count', v_connected, 'eligible_count', v_eligible,
                                   'required_count', v_required);
  ELSIF v_eligible = 0 THEN
    v_reject := jsonb_build_object('code', 'NO_ELIGIBLE_PARTICIPANTS',
                                   'connected_count', v_connected, 'eligible_count', 0,
                                   'required_count', v_required);
  END IF;

  IF v_reject IS NOT NULL THEN
    IF v_dry THEN
      RETURN v_reject || jsonb_build_object('ok', false, 'dry_run', true);
    END IF;
    v_cancel := public.rey_cancelar_ronda(p_session_id, v_reject);
    RETURN v_reject || jsonb_build_object('ok', false, 'dry_run', false,
             'cancelled', coalesce((v_cancel ->> 'cancelled')::boolean, false),
             'already_cancelled', false, 'cancel', v_cancel -> 'cancel');
  END IF;

  -- 7) Dry-run: termina acá. No elige, no escribe.
  IF v_dry THEN
    RETURN jsonb_build_object('ok', true, 'dry_run', true,
                              'raffle_state', v_gs.raffle_state,
                              'connected_count', v_connected, 'eligible_count', v_eligible,
                              'required_count', v_required,
                              'min_participants_enabled', v_min_on,
                              'block_repeat_winners_enabled', v_blk_on,
                              'jornada', v_jornada);
  END IF;

  -- 8) Selección uniforme dentro de elegibles
  SELECT cu.user_id, cu.name, cu.team, cu.avatar_id, cu.avatar_emoji
    INTO v_w
    FROM public.connected_users cu
   WHERE cu.session_id = p_session_id
     AND cu.user_id = ANY (v_elig_ids)
   ORDER BY random()
   LIMIT 1;

  -- 9) victoria_n: ON → 1 (UNIQUE rechaza repetidos). OFF → max + 1.
  IF v_blk_on THEN
    v_victoria := 1;
  ELSE
    SELECT (coalesce(max(g.victoria_n), 0) + 1)::smallint
      INTO v_victoria
      FROM public.rey_ganadores g
     WHERE g.jornada = v_jornada
       AND g.user_id = v_w.user_id;
  END IF;

  -- 10) Registrar + publicar como unidad. Cualquier conflicto revierte ambas cosas.
  --     RAFFLE_CONFLICT NO cancela la ronda.
  BEGIN
    INSERT INTO public.rey_ganadores
      (session_id, user_id, winner_name, prize_snapshot, round_key, jornada, victoria_n)
    VALUES
      (p_session_id, v_w.user_id, v_w.name, v_prize, v_now, v_jornada, v_victoria);

    UPDATE public.game_state
       SET raffle_state       = 'winner',
           raffle_winner_id   = v_w.user_id,
           raffle_winner_name = v_w.name,
           raffle_prize       = v_prize,
           raffle_cancel      = NULL
     WHERE session_id   = p_session_id
       AND raffle_state = 'launched';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
      RAISE EXCEPTION 'rey_resolver_sorteo: game_state no publicado' USING ERRCODE = 'RY409';
    END IF;
  EXCEPTION
    WHEN unique_violation OR SQLSTATE 'RY409' THEN
      RETURN jsonb_build_object('ok', false, 'code', 'RAFFLE_CONFLICT', 'dry_run', false);
  END;

  RETURN jsonb_build_object(
    'ok', true, 'dry_run', false, 'already_drawn', false,
    'winner', jsonb_build_object('user_id', v_w.user_id, 'name', v_w.name, 'team', v_w.team,
                                 'avatar_id', v_w.avatar_id, 'avatar_emoji', v_w.avatar_emoji),
    'prize', v_prize,
    'victoria_n', v_victoria,
    'jornada', v_jornada,
    'round_key', v_now,
    'connected_count', v_connected,
    'eligible_count', v_eligible,
    'required_count', v_required);
END;
$$;

COMMENT ON FUNCTION public.rey_resolver_sorteo(uuid, text, boolean) IS
  'Rey del Orto V1: resolución transaccional del sorteo (config + presencia + elegibilidad + selección + rey_ganadores + game_state). Rechazos operativos (MIN_PARTICIPANTS, NO_ELIGIBLE_PARTICIPANTS, RAFFLE_CONFIG_INCOMPLETE, INVALID_PRIZE) sobre una ronda launched la cancelan en la misma transacción (raffle_state=cancelled + raffle_cancel). Idempotente: already_drawn / already_cancelled. p_dry_run=true sólo valida y cuenta, sin lock ni escrituras. round_key = now() (transaction_timestamp). Ignora connected_users.excluded_raffle. Sólo service_role.';

REVOKE ALL ON FUNCTION public.rey_resolver_sorteo(uuid, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rey_resolver_sorteo(uuid, text, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.rey_resolver_sorteo(uuid, text, boolean) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rey_resolver_sorteo(uuid, text, boolean) TO service_role;
