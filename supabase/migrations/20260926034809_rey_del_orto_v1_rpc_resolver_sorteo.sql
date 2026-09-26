-- Rey del Orto V1 · RPC transaccional de resolución del sorteo
-- Única autoridad para: configuración, presencia, elegibilidad, selección,
-- registro en rey_ganadores y publicación en game_state.
-- NO lee ni escribe connected_users.excluded_raffle (legacy).
-- NO usa exclude_previous (legacy; lo ignora la Edge Function).
-- Ejecutable sólo por service_role (vía Edge Function launch-raffle).

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
BEGIN
  IF p_session_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_REQUEST', 'dry_run', v_dry);
  END IF;

  -- 1) Ronda. Resolución real: lock de la fila (serializa lanzamientos concurrentes).
  --    Dry-run: lectura simple, sin lock, sin escrituras.
  IF v_dry THEN
    SELECT gs.raffle_state, gs.raffle_winner_id, gs.raffle_winner_name, gs.raffle_prize
      INTO v_gs
      FROM public.game_state gs
     WHERE gs.session_id = p_session_id;
  ELSE
    SELECT gs.raffle_state, gs.raffle_winner_id, gs.raffle_winner_name, gs.raffle_prize
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

    IF v_gs.raffle_state IS DISTINCT FROM 'launched' THEN
      RETURN jsonb_build_object('ok', false, 'code', 'ROUND_NOT_LAUNCHED', 'dry_run', false);
    END IF;

    v_prize := nullif(btrim(p_prize), '');
    IF v_prize IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'code', 'INVALID_PRIZE', 'dry_run', false);
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

  IF v_min_found IS NOT TRUE OR v_blk_found IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'code', 'RAFFLE_CONFIG_INCOMPLETE', 'dry_run', v_dry);
  END IF;

  IF v_min_on THEN
    IF jsonb_typeof(v_min_value -> 'min') IS DISTINCT FROM 'number'
       OR (v_min_value ->> 'min') !~ '^[1-9][0-9]*$' THEN
      RETURN jsonb_build_object('ok', false, 'code', 'RAFFLE_CONFIG_INCOMPLETE', 'dry_run', v_dry);
    END IF;
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

  -- 5) Mínimo configurable
  IF v_min_on AND v_connected < v_required THEN
    RETURN jsonb_build_object('ok', false, 'code', 'MIN_PARTICIPANTS', 'dry_run', v_dry,
                              'connected_count', v_connected, 'eligible_count', v_eligible,
                              'required_count', v_required);
  END IF;

  -- 6) Bolsa vacía (aplica siempre, con o sin mínimo)
  IF v_eligible = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NO_ELIGIBLE_PARTICIPANTS', 'dry_run', v_dry,
                              'connected_count', v_connected, 'eligible_count', 0,
                              'required_count', v_required);
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
  BEGIN
    INSERT INTO public.rey_ganadores
      (session_id, user_id, winner_name, prize_snapshot, round_key, jornada, victoria_n)
    VALUES
      (p_session_id, v_w.user_id, v_w.name, v_prize, v_now, v_jornada, v_victoria);

    UPDATE public.game_state
       SET raffle_state       = 'winner',
           raffle_winner_id   = v_w.user_id,
           raffle_winner_name = v_w.name,
           raffle_prize       = v_prize
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
  'Rey del Orto V1: resolución transaccional del sorteo (config + presencia + elegibilidad + selección + rey_ganadores + game_state). p_dry_run=true sólo valida y cuenta, sin lock ni escrituras. round_key = now() (transaction_timestamp). Ignora connected_users.excluded_raffle. Sólo service_role.';

REVOKE ALL ON FUNCTION public.rey_resolver_sorteo(uuid, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rey_resolver_sorteo(uuid, text, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.rey_resolver_sorteo(uuid, text, boolean) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rey_resolver_sorteo(uuid, text, boolean) TO service_role;
