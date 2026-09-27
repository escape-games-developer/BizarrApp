-- Sumate que Sumamos · Backend V1 (robustez operativa)
-- Mecánica matemática SIN cambios: números 1–9 con repetidos, objetivo = suma de k (2..5)
-- números realmente asignados, grupo ganador ≥ 2, validación sólo en servidor.
--
-- Cambios:
--  1. sumate_rounds.cancel_reason + CHECKs de consistencia por estado.
--  2. Policy muerta "sumate_rounds: admin gestiona" eliminada (authenticated no tiene grants de escritura).
--  3. sumate_reglas_config (participantes_minimos) — patrón rey_reglas_config, independiente.
--  4. sumate_launch_round: atómico (config + presencia + ronda + assignments + game_state + video).
--  5. validate_sumate_group: respuestas estructuradas, idempotencia, vencimiento por jornada.
--  6. sumate_cancel_round(uuid, boolean): jsonb, idempotente, nunca degrada finished, cierre opcional del juego.
--  7. sumate_obtener_numero (jsonb) + sumate_ensure_assignment (int, compat): sesión + presencia.
--  8. sumate_check_target: ¿el objetivo sigue siendo formable con los presentes? (sólo lectura).
--  9. sumate_cerrar_jornada: cancela rondas playing al iniciar jornada.
-- 10. search_path = public, pg_temp; EXECUTE sólo authenticated/service_role.

-- ─────────────────────────────────────────────────────────────
-- 1) sumate_rounds: motivo de cancelación + consistencia por estado
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.sumate_rounds
  ADD COLUMN IF NOT EXISTS cancel_reason text;

ALTER TABLE public.sumate_rounds
  ADD CONSTRAINT sumate_rounds_cancel_reason_check
  CHECK (cancel_reason IS NULL OR cancel_reason = ANY (ARRAY['manual'::text, 'new_round'::text, 'jornada'::text, 'expired'::text]));

ALTER TABLE public.sumate_rounds
  ADD CONSTRAINT sumate_rounds_cancelled_consistente
  CHECK (status <> 'cancelled' OR (cancel_reason IS NOT NULL AND finished_at IS NOT NULL AND winner_group IS NULL));

ALTER TABLE public.sumate_rounds
  ADD CONSTRAINT sumate_rounds_finished_consistente
  CHECK (status <> 'finished' OR (winner_group IS NOT NULL AND finished_at IS NOT NULL AND cancel_reason IS NULL));

ALTER TABLE public.sumate_rounds
  ADD CONSTRAINT sumate_rounds_playing_consistente
  CHECK (status <> 'playing' OR (winner_group IS NULL AND finished_at IS NULL AND cancel_reason IS NULL));

COMMENT ON COLUMN public.sumate_rounds.cancel_reason IS
  'Motivo de cancelación: manual (operador), new_round (reemplazada por un lanzamiento), jornada (inicio de jornada), expired (ronda de una jornada anterior).';

-- 2) Policy muerta: authenticated no tiene INSERT/UPDATE/DELETE sobre la tabla; toda escritura pasa por RPC.
DROP POLICY IF EXISTS "sumate_rounds: admin gestiona" ON public.sumate_rounds;

-- ─────────────────────────────────────────────────────────────
-- 3) Configuración de reglas de Sumate (independiente de Rey del Orto)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.sumate_reglas_config (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text        NOT NULL,
  enabled     boolean     NOT NULL DEFAULT true,
  value       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  updated_by  uuid        NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sumate_reglas_config_key_key UNIQUE (key),
  CONSTRAINT sumate_reglas_config_key_formato CHECK (key ~ '^[a-z][a-z0-9_]{2,63}$'),
  CONSTRAINT sumate_reglas_config_value_objeto CHECK (jsonb_typeof(value) = 'object'),
  CONSTRAINT sumate_reglas_config_participantes_minimos_valido CHECK (
    key <> 'participantes_minimos' OR (
      CASE WHEN jsonb_typeof(value->'min') = 'number'
                AND (value - 'min') = '{}'::jsonb
                AND (value->>'min') ~ '^[1-9][0-9]*$'
           THEN (value->>'min')::int BETWEEN 1 AND 100
           ELSE false
      END))
);

COMMENT ON TABLE public.sumate_reglas_config IS
  'Sumate que Sumamos: reglas operativas globales (una fila por regla). Keys definidas por migración; Admin sólo SELECT/UPDATE de enabled/value/updated_by. El mínimo estructural del juego (2) vive en las RPC y no es configurable.';

CREATE TRIGGER sumate_reglas_config_updated_at
  BEFORE UPDATE ON public.sumate_reglas_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.sumate_reglas_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sumate_reglas_config: admin lee"
  ON public.sumate_reglas_config FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "sumate_reglas_config: admin actualiza"
  ON public.sumate_reglas_config FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

REVOKE ALL ON TABLE public.sumate_reglas_config FROM PUBLIC;
REVOKE ALL ON TABLE public.sumate_reglas_config FROM anon;
REVOKE ALL ON TABLE public.sumate_reglas_config FROM authenticated;
GRANT SELECT ON TABLE public.sumate_reglas_config TO authenticated;
GRANT UPDATE (enabled, value, updated_by) ON TABLE public.sumate_reglas_config TO authenticated;

INSERT INTO public.sumate_reglas_config (key, enabled, value) VALUES
  ('participantes_minimos', true, '{"min": 2}'::jsonb);

-- ─────────────────────────────────────────────────────────────
-- 4) Lanzamiento atómico
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sumate_launch_round(p_session uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  c_min_estructural constant int      := 2;                    -- el juego necesita ≥2 números para armar una suma
  c_presencia       constant interval := interval '2 minutes'; -- misma ventana que Rey del Orto (>=)
  v_now      timestamptz := now();
  v_cfg_on   boolean;
  v_cfg_val  jsonb;
  v_cfg_min  int;
  v_required int;
  v_users    uuid[];
  v_nums     int[];
  v_n        int;
  v_k        int;
  v_target   int;
  v_round    uuid;
  v_prev     uuid;
BEGIN
  IF p_session IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_REQUEST', 'error', 'Falta la sesión');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'UNAUTHORIZED', 'error', 'Solo un administrador puede lanzar la ronda');
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

  -- Presentes + número 1–9 para cada uno (mecánica original).
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

  -- Objetivo: suma de k números REALMENTE asignados (algoritmo original).
  v_k := CASE WHEN v_n >= 3
              THEN 3 + floor(random() * (LEAST(5, v_n) - 2))::int
              ELSE 2 END;
  SELECT sum(n) INTO v_target
    FROM (SELECT unnest(v_nums) AS n ORDER BY random() LIMIT v_k) s;

  BEGIN
    UPDATE public.sumate_rounds
       SET status = 'cancelled', finished_at = v_now, cancel_reason = 'new_round'
     WHERE session_id = p_session AND status = 'playing'
    RETURNING id INTO v_prev;

    INSERT INTO public.sumate_rounds (session_id, target_number, status)
    VALUES (p_session, v_target, 'playing')
    RETURNING id INTO v_round;

    INSERT INTO public.sumate_assignments (round_id, user_id, assigned_number)
    SELECT v_round, u, n FROM unnest(v_users, v_nums) AS t(u, n);

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
    'active_game', 'suma');
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 5) Validación del grupo (única autoridad)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.validate_sumate_group(p_round_id uuid, p_user_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now       timestamptz := now();
  v_hoy       date := ((v_now AT TIME ZONE 'America/Argentina/Buenos_Aires') - interval '6 hours')::date;
  v_r         record;
  v_pedidos   int := coalesce(array_length(p_user_ids, 1), 0);
  v_distintos int;
  v_hallados  int;
  v_sum       int;
  v_missing   jsonb;
  v_group     jsonb;
  v_filas     int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'UNAUTHORIZED', 'error', 'Solo un administrador puede validar el grupo');
  END IF;
  IF p_round_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_REQUEST', 'error', 'Falta la ronda');
  END IF;

  SELECT id, session_id, target_number, status, winner_group, cancel_reason, created_at
    INTO v_r
    FROM public.sumate_rounds WHERE id = p_round_id
    FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ROUND_NOT_FOUND', 'error', 'La ronda no existe');
  END IF;

  IF v_r.status = 'finished' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ROUND_ALREADY_FINISHED',
      'error', 'La ronda ya tiene grupo ganador', 'round_id', v_r.id,
      'target', v_r.target_number, 'winner_group', v_r.winner_group);
  END IF;
  IF v_r.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ROUND_ALREADY_CANCELLED',
      'error', 'La ronda fue cancelada', 'round_id', v_r.id, 'cancel_reason', v_r.cancel_reason);
  END IF;

  -- Ronda de una jornada anterior: se cierra acá mismo (fila ya bloqueada).
  IF ((v_r.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires') - interval '6 hours')::date < v_hoy THEN
    UPDATE public.sumate_rounds
       SET status = 'cancelled', finished_at = v_now, cancel_reason = 'expired'
     WHERE id = v_r.id AND status = 'playing';
    RETURN jsonb_build_object('ok', false, 'code', 'ROUND_EXPIRED',
      'error', 'La ronda es de una jornada anterior y quedó cancelada', 'round_id', v_r.id, 'cancelled', true);
  END IF;

  IF v_pedidos < 2 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_GROUP', 'reason', 'MIN_SIZE',
      'error', 'El grupo debe tener al menos 2 participantes', 'group_size', v_pedidos);
  END IF;
  SELECT count(DISTINCT u) INTO v_distintos FROM unnest(p_user_ids) AS u;
  IF v_distintos <> v_pedidos THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_GROUP', 'reason', 'DUPLICATE_OR_NULL',
      'error', 'Hay participantes repetidos o vacíos en el grupo');
  END IF;

  SELECT count(a.user_id), coalesce(sum(a.assigned_number), 0),
         coalesce(jsonb_agg(t.u) FILTER (WHERE a.user_id IS NULL), '[]'::jsonb)
    INTO v_hallados, v_sum, v_missing
    FROM unnest(p_user_ids) AS t(u)
    LEFT JOIN public.sumate_assignments a
           ON a.round_id = v_r.id AND a.user_id = t.u;

  IF v_hallados <> v_pedidos THEN
    RETURN jsonb_build_object('ok', false, 'code', 'MISSING_ASSIGNMENT',
      'error', 'Alguno de los seleccionados no tiene número en esta ronda', 'missing_user_ids', v_missing);
  END IF;

  IF v_sum <> v_r.target_number THEN
    RETURN jsonb_build_object('ok', false, 'code', 'WRONG_SUM',
      'error', format('El grupo suma %s y el objetivo es %s', v_sum, v_r.target_number),
      'sum', v_sum, 'target', v_r.target_number, 'status', 'playing');
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
           'user_id',         a.user_id,
           'name',            coalesce(cu.name, 'Jugador'),
           'avatar_emoji',    cu.avatar_emoji,
           'assigned_number', a.assigned_number
         ) ORDER BY a.assigned_number DESC)
    INTO v_group
    FROM public.sumate_assignments a
    LEFT JOIN public.connected_users cu
           ON cu.user_id = a.user_id AND cu.session_id = v_r.session_id
   WHERE a.round_id = v_r.id AND a.user_id = ANY (p_user_ids);

  UPDATE public.sumate_rounds
     SET status = 'finished', winner_group = v_group, finished_at = v_now
   WHERE id = v_r.id AND status = 'playing';
  GET DIAGNOSTICS v_filas = ROW_COUNT;
  IF v_filas = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'CONFLICT', 'error', 'La ronda cambió mientras se validaba; reintentá');
  END IF;

  RETURN jsonb_build_object('ok', true, 'code', 'WINNER', 'round_id', v_r.id,
    'sum', v_sum, 'target', v_r.target_number, 'winner_group', v_group);
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 6) Cancelación estructurada e idempotente (cambia el tipo de retorno → DROP + CREATE)
-- ─────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.sumate_cancel_round(uuid);

CREATE FUNCTION public.sumate_cancel_round(p_round_id uuid, p_close_game boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now    timestamptz := now();
  v_r      record;
  v_res    jsonb;
  v_rows   int := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'UNAUTHORIZED', 'error', 'Solo un administrador puede cerrar la ronda');
  END IF;
  IF p_round_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_REQUEST', 'error', 'Falta la ronda');
  END IF;

  SELECT id, session_id, status, cancel_reason INTO v_r
    FROM public.sumate_rounds WHERE id = p_round_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ROUND_NOT_FOUND', 'error', 'La ronda no existe');
  END IF;

  -- Mismo orden de locks que el lanzamiento: game_state primero, después la ronda.
  IF coalesce(p_close_game, false) THEN
    PERFORM 1 FROM public.game_state WHERE session_id = v_r.session_id FOR UPDATE;
  END IF;

  SELECT id, session_id, status, cancel_reason INTO v_r
    FROM public.sumate_rounds WHERE id = p_round_id FOR UPDATE;

  IF v_r.status = 'playing' THEN
    UPDATE public.sumate_rounds
       SET status = 'cancelled', finished_at = v_now, cancel_reason = 'manual'
     WHERE id = v_r.id AND status = 'playing';
    v_res := jsonb_build_object('ok', true, 'code', 'CANCELLED', 'cancelled', true, 'already_cancelled', false);
  ELSIF v_r.status = 'cancelled' THEN
    v_res := jsonb_build_object('ok', true, 'code', 'ROUND_ALREADY_CANCELLED', 'cancelled', false,
                                'already_cancelled', true, 'cancel_reason', v_r.cancel_reason);
  ELSE
    v_res := jsonb_build_object('ok', false, 'code', 'ROUND_ALREADY_FINISHED', 'cancelled', false,
                                'error', 'La ronda ya terminó con ganador; no se puede cancelar');
  END IF;

  -- Opcional: sacar Sumate del aire (mismo efecto que deactivateGame).
  IF coalesce(p_close_game, false) THEN
    UPDATE public.game_state
       SET active_game = NULL, active_placa = NULL
     WHERE session_id = v_r.session_id AND active_game = 'suma';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows > 0 THEN
      UPDATE public.video_requests
         SET status = 'dismissed'
       WHERE session_id = v_r.session_id AND status = 'launched';
    END IF;
  END IF;

  RETURN v_res || jsonb_build_object('round_id', v_r.id, 'game_closed', v_rows > 0);
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 7) Número del participante: sesión + presencia; idempotente
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sumate_obtener_numero(p_round uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  c_presencia constant interval := interval '2 minutes';
  v_now  timestamptz := now();
  v_hoy  date := ((v_now AT TIME ZONE 'America/Argentina/Buenos_Aires') - interval '6 hours')::date;
  v_user uuid := auth.uid();
  v_r    record;
  v_num  int;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'UNAUTHORIZED', 'error', 'No autenticado');
  END IF;
  IF p_round IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_REQUEST', 'error', 'Falta la ronda');
  END IF;

  SELECT id, session_id, status, created_at INTO v_r
    FROM public.sumate_rounds WHERE id = p_round;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ROUND_NOT_FOUND', 'error', 'La ronda no existe');
  END IF;

  -- Reconexión / F5: si ya tiene número, es el mismo, en cualquier estado de la ronda.
  SELECT assigned_number INTO v_num
    FROM public.sumate_assignments WHERE round_id = v_r.id AND user_id = v_user;
  IF v_num IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'code', 'ASSIGNED', 'assigned_number', v_num,
                              'already_assigned', true, 'round_id', v_r.id, 'status', v_r.status);
  END IF;

  IF v_r.status = 'finished' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ROUND_ALREADY_FINISHED', 'error', 'La ronda ya terminó');
  END IF;
  IF v_r.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ROUND_ALREADY_CANCELLED', 'error', 'La ronda fue cancelada');
  END IF;
  IF ((v_r.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires') - interval '6 hours')::date < v_hoy THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ROUND_EXPIRED', 'error', 'La ronda es de una jornada anterior');
  END IF;

  -- Entrada tardía legítima: tiene que estar presente EN la sesión de la ronda.
  IF NOT EXISTS (SELECT 1 FROM public.connected_users cu
                  WHERE cu.session_id = v_r.session_id AND cu.user_id = v_user
                    AND cu.last_seen >= v_now - c_presencia) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_PRESENT',
      'error', 'Tenés que estar conectado a la sesión para recibir número');
  END IF;

  INSERT INTO public.sumate_assignments (round_id, user_id, assigned_number)
  VALUES (v_r.id, v_user, (1 + floor(random() * 9))::int)
  ON CONFLICT (round_id, user_id) DO NOTHING;

  SELECT assigned_number INTO v_num
    FROM public.sumate_assignments WHERE round_id = v_r.id AND user_id = v_user;

  RETURN jsonb_build_object('ok', true, 'code', 'ASSIGNED', 'assigned_number', v_num,
                            'already_assigned', false, 'round_id', v_r.id, 'status', v_r.status);
END;
$$;

-- Compatibilidad con el Cliente desplegado (espera un entero). Misma lógica endurecida.
CREATE OR REPLACE FUNCTION public.sumate_ensure_assignment(p_round uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_res jsonb;
BEGIN
  v_res := public.sumate_obtener_numero(p_round);
  IF (v_res ->> 'ok')::boolean THEN
    RETURN (v_res ->> 'assigned_number')::int;
  END IF;
  RAISE EXCEPTION '%', coalesce(v_res ->> 'error', 'no se pudo asignar número')
    USING HINT = coalesce(v_res ->> 'code', 'UNKNOWN');
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 8) ¿El objetivo sigue siendo formable con los presentes? (sólo lectura)
--    Regla real de validación: cualquier grupo de ≥2 personas cuya suma sea el objetivo.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sumate_check_target(p_round_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  c_presencia constant interval := interval '2 minutes';
  v_now   timestamptz := now();
  v_hoy   date := ((v_now AT TIME ZONE 'America/Argentina/Buenos_Aires') - interval '6 hours')::date;
  v_r     record;
  v_nums  int[];
  v_total int;
  v_t     int;
  v_x     int;
  v_s     int;
  v_d1    boolean[];   -- suma s alcanzable con exactamente 1 número
  v_d2    boolean[];   -- suma s alcanzable con 2 o más números
  v_n1    boolean[];
  v_n2    boolean[];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'UNAUTHORIZED', 'error', 'Solo un administrador puede consultar el objetivo');
  END IF;

  SELECT id, session_id, target_number, status, created_at INTO v_r
    FROM public.sumate_rounds WHERE id = p_round_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ROUND_NOT_FOUND', 'error', 'La ronda no existe');
  END IF;
  IF v_r.status = 'finished' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ROUND_ALREADY_FINISHED', 'error', 'La ronda ya terminó');
  END IF;
  IF v_r.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ROUND_ALREADY_CANCELLED', 'error', 'La ronda fue cancelada');
  END IF;
  IF ((v_r.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires') - interval '6 hours')::date < v_hoy THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ROUND_EXPIRED', 'error', 'La ronda es de una jornada anterior');
  END IF;

  SELECT count(*) INTO v_total FROM public.sumate_assignments WHERE round_id = v_r.id;

  SELECT coalesce(array_agg(a.assigned_number), '{}'::int[]) INTO v_nums
    FROM public.sumate_assignments a
    JOIN public.connected_users cu
      ON cu.session_id = v_r.session_id AND cu.user_id = a.user_id
     AND cu.last_seen >= v_now - c_presencia
   WHERE a.round_id = v_r.id;

  v_t  := v_r.target_number;
  v_d1 := array_fill(false, ARRAY[v_t]);
  v_d2 := array_fill(false, ARRAY[v_t]);

  FOREACH v_x IN ARRAY v_nums LOOP
    CONTINUE WHEN v_x > v_t;
    v_n1 := v_d1;
    v_n2 := v_d2;
    FOR v_s IN (v_x + 1) .. v_t LOOP
      IF v_d1[v_s - v_x] OR v_d2[v_s - v_x] THEN
        v_n2[v_s] := true;
      END IF;
    END LOOP;
    v_n1[v_x] := true;
    v_d1 := v_n1;
    v_d2 := v_n2;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'code', CASE WHEN v_d2[v_t] THEN 'TARGET_POSSIBLE' ELSE 'TARGET_NO_LONGER_POSSIBLE' END,
    'possible', v_d2[v_t],
    'round_id', v_r.id,
    'target', v_t,
    'present_with_number', coalesce(array_length(v_nums, 1), 0),
    'assigned_total', v_total,
    'min_group_size', 2);
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 9) Inicio de jornada: cerrar rondas vivas de la jornada anterior
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sumate_cerrar_jornada(p_session uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ids jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'UNAUTHORIZED', 'error', 'Solo un administrador puede iniciar la jornada');
  END IF;
  IF p_session IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_REQUEST', 'error', 'Falta la sesión');
  END IF;

  WITH c AS (
    UPDATE public.sumate_rounds
       SET status = 'cancelled', finished_at = now(), cancel_reason = 'jornada'
     WHERE session_id = p_session AND status = 'playing'
    RETURNING id
  )
  SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids FROM c;

  RETURN jsonb_build_object('ok', true, 'code', 'JORNADA_CERRADA',
                            'cancelled_count', jsonb_array_length(v_ids), 'cancelled_round_ids', v_ids);
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 10) Permisos: sólo authenticated (con chequeo de admin interno) y service_role
-- ─────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.sumate_launch_round(uuid)               FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.validate_sumate_group(uuid, uuid[])     FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sumate_cancel_round(uuid, boolean)      FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sumate_obtener_numero(uuid)             FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sumate_ensure_assignment(uuid)          FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sumate_check_target(uuid)               FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sumate_cerrar_jornada(uuid)             FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.sumate_launch_round(uuid)            TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.validate_sumate_group(uuid, uuid[])  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sumate_cancel_round(uuid, boolean)   TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sumate_obtener_numero(uuid)          TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sumate_ensure_assignment(uuid)       TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sumate_check_target(uuid)            TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sumate_cerrar_jornada(uuid)          TO authenticated, service_role;

COMMENT ON FUNCTION public.sumate_launch_round(uuid) IS 'Sumate V1: lanzamiento atómico (config + presencia >= 2 min + ronda + assignments + game_state active_game=suma + video dismissed). jsonb {ok, code}.';
COMMENT ON FUNCTION public.validate_sumate_group(uuid, uuid[]) IS 'Sumate V1: única autoridad de ganador. FOR UPDATE sobre la ronda. WRONG_SUM no cierra la ronda. jsonb {ok, code}.';
COMMENT ON FUNCTION public.sumate_cancel_round(uuid, boolean) IS 'Sumate V1: cancelación idempotente; nunca degrada finished. p_close_game=true saca Sumate del aire.';
COMMENT ON FUNCTION public.sumate_obtener_numero(uuid) IS 'Sumate V1: número del participante (idempotente). Exige presencia en la sesión de la ronda para asignar uno nuevo.';
COMMENT ON FUNCTION public.sumate_ensure_assignment(uuid) IS 'Sumate V1: COMPAT (devuelve int). Envuelve sumate_obtener_numero; se retira cuando el frontend migre.';
COMMENT ON FUNCTION public.sumate_check_target(uuid) IS 'Sumate V1: ¿existe un grupo de ≥2 presentes cuya suma sea el objetivo? Sólo lectura.';
COMMENT ON FUNCTION public.sumate_cerrar_jornada(uuid) IS 'Sumate V1: cancela rondas playing de la sesión (cancel_reason=jornada). Llamar desde iniciarJornada().';
