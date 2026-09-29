-- Sumate que Sumamos V1 — Biblioteca de objetivos + target opcional en el lanzamiento.
-- * Tabla global de objetivos (3–45), sólo admin, sin UPDATE.
-- * sumate_launch_round(p_session, p_target DEFAULT NULL):
--     NULL      → modo automático, idéntico al contrato anterior.
--     informado → valida rango + biblioteca, exige GREATEST(2, config, ceil(T/9)) presentes,
--                 planta una solución real y, si alcanza la gente, una segunda disjunta.
--   No se guarda ni se expone quiénes forman las soluciones plantadas.

-- ── Biblioteca ──────────────────────────────────────────────────────────────
CREATE TABLE public.sumate_objetivos_biblioteca (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  target     int         NOT NULL,
  created_by uuid        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sumate_objetivos_biblioteca_target_key   UNIQUE (target),
  CONSTRAINT sumate_objetivos_biblioteca_target_rango CHECK (target BETWEEN 3 AND 45)
);

ALTER TABLE public.sumate_objetivos_biblioteca ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sumate_objetivos_biblioteca: admin lee"
  ON public.sumate_objetivos_biblioteca FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY "sumate_objetivos_biblioteca: admin inserta"
  ON public.sumate_objetivos_biblioteca FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY "sumate_objetivos_biblioteca: admin borra"
  ON public.sumate_objetivos_biblioteca FOR DELETE TO authenticated
  USING (public.is_admin());

REVOKE ALL ON TABLE public.sumate_objetivos_biblioteca FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON TABLE public.sumate_objetivos_biblioteca TO authenticated;
GRANT INSERT (target) ON TABLE public.sumate_objetivos_biblioteca TO authenticated;
GRANT ALL ON TABLE public.sumate_objetivos_biblioteca TO service_role;

INSERT INTO public.sumate_objetivos_biblioteca (target) VALUES (15), (20), (25), (30);

-- ── RPC: reemplazo de firma (sin overload ambiguo) ─────────────────────────
DROP FUNCTION public.sumate_launch_round(uuid);

CREATE FUNCTION public.sumate_launch_round(p_session uuid, p_target int DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  c_min_estructural constant int      := 2;                    -- el juego necesita ≥2 números para armar una suma
  c_presencia       constant interval := interval '2 minutes'; -- misma ventana que Rey del Orto (>=)
  c_max_grupo       constant int      := 5;                    -- tamaño máximo de un grupo plantado (igual que el automático)
  c_target_min      constant int      := 3;
  c_target_max      constant int      := 45;
  v_now        timestamptz := now();
  v_cfg_on     boolean;
  v_cfg_val    jsonb;
  v_cfg_min    int;
  v_required   int;
  v_users      uuid[];
  v_nums       int[];
  v_n          int;
  v_k          int;
  v_target     int;
  v_round      uuid;
  v_prev       uuid;
  v_source     text;
  v_target_min int;
  v_kcap       int;
  v_pos        int;
  v_rem        int;
  v_i          int;
  v_sol        int;
  v_parts      int[];
  v_planted    int;
BEGIN
  IF p_session IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_REQUEST', 'error', 'Falta la sesión');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'UNAUTHORIZED', 'error', 'Solo un administrador puede lanzar la ronda');
  END IF;
  IF p_target IS NOT NULL AND (p_target < c_target_min OR p_target > c_target_max) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_TARGET',
      'error', format('El objetivo debe ser un entero entre %s y %s', c_target_min, c_target_max),
      'target', p_target, 'min_target', c_target_min, 'max_target', c_target_max);
  END IF;

  -- Lock de la fila de game_state: serializa lanzamientos y ordena los locks
  -- igual que el resto del proyecto (game_state primero).
  PERFORM 1 FROM public.game_state WHERE session_id = p_session FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'SESSION_NOT_FOUND', 'error', 'La sesión no tiene game_state');
  END IF;

  SELECT enabled, value INTO v_cfg_on, v_cfg_val
    FROM public.sumate_reglas_config WHERE key = 'participantes_minimos';
  IF NOT FOUND
     OR (v_cfg_on AND (jsonb_typeof(v_cfg_val -> 'min') IS DISTINCT FROM 'number'
                       OR (v_cfg_val ->> 'min') !~ '^[1-9][0-9]*$')) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'CONFIG_INCOMPLETE', 'error', 'Falta o es inválida la regla participantes_minimos');
  END IF;
  IF v_cfg_on THEN
    v_cfg_min := (v_cfg_val ->> 'min')::int;
  END IF;
  v_required := GREATEST(c_min_estructural, coalesce(v_cfg_min, 0));

  IF p_target IS NULL THEN
    -- ═══ MODO AUTOMÁTICO: mismo algoritmo y mismas respuestas que antes ═══
    v_source := 'random';

    SELECT array_agg(cu.user_id ORDER BY cu.user_id),
           array_agg((1 + floor(random() * 9))::int ORDER BY cu.user_id)
      INTO v_users, v_nums
      FROM public.connected_users cu
     WHERE cu.session_id = p_session
       AND cu.last_seen >= v_now - c_presencia;
    v_n := coalesce(array_length(v_users, 1), 0);

    IF v_n < v_required THEN
      RETURN jsonb_build_object('ok', false, 'code', 'MIN_PARTICIPANTS',
        'error', format('Se necesitan al menos %s participantes conectados (hay %s)', v_required, v_n),
        'connected_count', v_n, 'required_count', v_required,
        'structural_min', c_min_estructural, 'configured_min', v_cfg_min,
        'min_participants_enabled', v_cfg_on);
    END IF;

    -- Objetivo: suma de k números REALMENTE asignados.
    v_k := CASE WHEN v_n >= 3
                THEN 3 + floor(random() * (LEAST(5, v_n) - 2))::int
                ELSE 2 END;
    SELECT sum(n) INTO v_target
      FROM (SELECT unnest(v_nums) AS n ORDER BY random() LIMIT v_k) s;
    v_target_min := GREATEST(c_min_estructural, ceil(v_target / 9.0)::int);
    v_planted    := NULL;
  ELSE
    -- ═══ MODO BIBLIOTECA ═══
    IF NOT EXISTS (SELECT 1 FROM public.sumate_objetivos_biblioteca WHERE target = p_target) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'TARGET_NOT_IN_LIBRARY',
        'error', format('El objetivo %s no está en la biblioteca', p_target), 'target', p_target);
    END IF;
    v_source     := 'library';
    v_target     := p_target;
    v_target_min := GREATEST(c_min_estructural, ceil(p_target / 9.0)::int);
    v_required   := GREATEST(v_required, v_target_min);

    -- Orden aleatorio: la posición no revela quién integra la solución plantada.
    SELECT array_agg(cu.user_id ORDER BY random())
      INTO v_users
      FROM public.connected_users cu
     WHERE cu.session_id = p_session
       AND cu.last_seen >= v_now - c_presencia;
    v_n := coalesce(array_length(v_users, 1), 0);

    IF v_n < v_required THEN
      RETURN jsonb_build_object('ok', false, 'code', 'MIN_PARTICIPANTS',
        'error', format('Para el objetivo %s se necesitan al menos %s participantes conectados (hay %s)', v_target, v_required, v_n),
        'connected_count', v_n, 'required_count', v_required,
        'target', v_target, 'target_min_participants', v_target_min,
        'structural_min', c_min_estructural, 'configured_min', v_cfg_min,
        'min_participants_enabled', v_cfg_on, 'target_source', v_source);
    END IF;

    -- Plantado: solución 1 obligatoria; solución 2 disjunta sólo si alcanza la gente.
    -- v_n >= v_target_min está garantizado, así que la solución 1 siempre entra.
    v_nums    := array_fill(0, ARRAY[v_n]);
    v_pos     := 0;
    v_planted := 0;
    FOR v_sol IN 1..2 LOOP
      EXIT WHEN v_n - v_pos < v_target_min;
      v_kcap := LEAST(v_n - v_pos, c_max_grupo, v_target);
      -- Si hay gente para dos soluciones, la primera deja lugar para la segunda.
      IF v_sol = 1 AND v_n >= 2 * v_target_min THEN
        v_kcap := LEAST(v_kcap, v_n - v_target_min);
      END IF;
      v_k := v_target_min + floor(random() * (v_kcap - v_target_min + 1))::int;

      -- Composición aleatoria de T en k partes de 1..9 (T <= 9k por construcción).
      v_parts := array_fill(1, ARRAY[v_k]);
      v_rem   := v_target - v_k;
      WHILE v_rem > 0 LOOP
        v_i := 1 + floor(random() * v_k)::int;
        IF v_parts[v_i] < 9 THEN
          v_parts[v_i] := v_parts[v_i] + 1;
          v_rem := v_rem - 1;
        END IF;
      END LOOP;

      FOR v_i IN 1..v_k LOOP
        v_nums[v_pos + v_i] := v_parts[v_i];
      END LOOP;
      v_pos     := v_pos + v_k;
      v_planted := v_planted + 1;
    END LOOP;

    FOR v_i IN (v_pos + 1)..v_n LOOP
      v_nums[v_i] := (1 + floor(random() * 9))::int;
    END LOOP;
  END IF;

  BEGIN
    UPDATE public.sumate_rounds
       SET status = 'cancelled', finished_at = v_now, cancel_reason = 'new_round'
     WHERE session_id = p_session AND status = 'playing'
    RETURNING id INTO v_prev;

    INSERT INTO public.sumate_rounds (session_id, target_number, status)
    VALUES (p_session, v_target, 'playing')
    RETURNING id INTO v_round;

    INSERT INTO public.sumate_assignments (round_id, user_id, assigned_number)
    SELECT v_round, u, n FROM unnest(v_users, v_nums) AS t(u, n) ORDER BY u;

    -- Mismo efecto que activateGame('suma') del frontend.
    UPDATE public.game_state
       SET active_game = 'suma', active_placa = NULL, active_escenario = NULL, placa_custom = NULL
     WHERE session_id = p_session;

    UPDATE public.video_requests
       SET status = 'dismissed'
     WHERE session_id = p_session AND status = 'launched';
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'code', 'CONFLICT', 'error', 'Otro lanzamiento se cruzó con este; reintentá');
  END;

  RETURN jsonb_build_object(
    'ok', true, 'code', 'LAUNCHED',
    'round_id', v_round,
    'target_number', v_target,
    'participants', v_n,
    'required_count', v_required,
    'structural_min', c_min_estructural,
    'configured_min', v_cfg_min,
    'min_participants_enabled', v_cfg_on,
    'previous_round_cancelled', v_prev,
    'active_game', 'suma',
    'target_source', v_source,
    'target_min_participants', v_target_min,
    'solutions_planted', v_planted);
END;
$function$;

REVOKE ALL ON FUNCTION public.sumate_launch_round(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sumate_launch_round(uuid, int) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
