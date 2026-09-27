
-- SUMATE QUE SUMAMOS — ronda multiusuario con número por persona
-- Ver spec y comentarios en repo: supabase/migrations/<ts>_sumate_que_sumamos.sql

-- ── 1) Rondas ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sumate_rounds (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid        NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  target_number int         NOT NULL CHECK (target_number > 0),
  status        text        NOT NULL DEFAULT 'playing'
                            CHECK (status IN ('playing','finished','cancelled')),
  winner_group  jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz
);

COMMENT ON TABLE  public.sumate_rounds IS
  'Rondas de Sumate que Sumamos. El objetivo se deriva de assignments reales: siempre tiene solución.';
COMMENT ON COLUMN public.sumate_rounds.winner_group IS
  'Snapshot del grupo validado. NULL mientras la ronda sigue abierta.';

CREATE INDEX IF NOT EXISTS sumate_rounds_session_idx ON public.sumate_rounds (session_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS sumate_rounds_una_viva_idx
  ON public.sumate_rounds (session_id) WHERE status = 'playing';

-- ── 2) Números por persona ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sumate_assignments (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id        uuid        NOT NULL REFERENCES public.sumate_rounds(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_number int         NOT NULL CHECK (assigned_number BETWEEN 1 AND 9),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (round_id, user_id)
);

CREATE INDEX IF NOT EXISTS sumate_assignments_round_idx ON public.sumate_assignments (round_id);

-- ── 3) RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE public.sumate_rounds      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sumate_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sumate_rounds: todos leen" ON public.sumate_rounds;
CREATE POLICY "sumate_rounds: todos leen"
  ON public.sumate_rounds FOR SELECT USING (true);

DROP POLICY IF EXISTS "sumate_rounds: admin gestiona" ON public.sumate_rounds;
CREATE POLICY "sumate_rounds: admin gestiona"
  ON public.sumate_rounds FOR ALL
  USING      (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "sumate_assignments: cada uno ve el suyo" ON public.sumate_assignments;
CREATE POLICY "sumate_assignments: cada uno ve el suyo"
  ON public.sumate_assignments FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "sumate_assignments: admin ve todos" ON public.sumate_assignments;
CREATE POLICY "sumate_assignments: admin ve todos"
  ON public.sumate_assignments FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- ── 3b) Privilegios de tabla explícitos ─────────────────────────────────────
GRANT SELECT ON public.sumate_rounds      TO anon, authenticated;
GRANT SELECT ON public.sumate_assignments TO authenticated;

REVOKE INSERT, UPDATE, DELETE ON public.sumate_rounds      FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.sumate_assignments FROM anon, authenticated;
REVOKE ALL ON public.sumate_assignments FROM anon;

-- ── 4) Lanzar ronda ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sumate_launch_round(p_session uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_round   uuid;
  v_target  int;
  v_n       int;
  v_k       int;
  v_users   uuid[];
  v_nums    int[];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'solo un administrador puede lanzar la ronda';
  END IF;

  SELECT array_agg(cu.user_id ORDER BY cu.user_id),
         array_agg((1 + floor(random() * 9))::int ORDER BY cu.user_id)
    INTO v_users, v_nums
    FROM connected_users cu
   WHERE cu.session_id = p_session
     AND cu.last_seen > now() - interval '2 minutes';

  v_n := coalesce(array_length(v_users, 1), 0);
  IF v_n < 2 THEN
    RAISE EXCEPTION 'se necesitan al menos 2 participantes conectados (hay %)', v_n;
  END IF;

  UPDATE sumate_rounds
     SET status = 'cancelled', finished_at = now()
   WHERE session_id = p_session AND status = 'playing';

  v_k := CASE WHEN v_n >= 3
              THEN 3 + floor(random() * (LEAST(5, v_n) - 2))::int
              ELSE 2 END;

  SELECT sum(n) INTO v_target
    FROM (SELECT unnest(v_nums) AS n ORDER BY random() LIMIT v_k) s;

  INSERT INTO sumate_rounds (session_id, target_number, status)
  VALUES (p_session, v_target, 'playing')
  RETURNING id INTO v_round;

  INSERT INTO sumate_assignments (round_id, user_id, assigned_number)
  SELECT v_round, u, n FROM unnest(v_users, v_nums) AS t(u, n);

  RETURN jsonb_build_object(
    'round_id', v_round,
    'target_number', v_target,
    'participants', v_n
  );
END $$;

REVOKE ALL ON FUNCTION public.sumate_launch_round(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sumate_launch_round(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.sumate_launch_round(uuid) TO authenticated;

-- ── 5) Late joiner ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sumate_ensure_assignment(p_round uuid)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_num  int;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM sumate_rounds WHERE id = p_round AND status = 'playing') THEN
    RAISE EXCEPTION 'la ronda no está abierta';
  END IF;

  INSERT INTO sumate_assignments (round_id, user_id, assigned_number)
  VALUES (p_round, v_user, (1 + floor(random() * 9))::int)
  ON CONFLICT (round_id, user_id) DO NOTHING;

  SELECT assigned_number INTO v_num
    FROM sumate_assignments WHERE round_id = p_round AND user_id = v_user;
  RETURN v_num;
END $$;

REVOKE ALL ON FUNCTION public.sumate_ensure_assignment(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sumate_ensure_assignment(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.sumate_ensure_assignment(uuid) TO authenticated;

-- ── 6) Validar el grupo ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.validate_sumate_group(p_round_id uuid, p_user_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target    int;
  v_sum       int;
  v_hallados  int;
  v_pedidos   int := coalesce(array_length(p_user_ids, 1), 0);
  v_distintos int;
  v_filas     int;
  v_session   uuid;
  v_group     jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'solo un administrador puede validar el grupo';
  END IF;

  IF v_pedidos < 2 THEN
    RAISE EXCEPTION 'el grupo debe tener al menos 2 participantes';
  END IF;

  SELECT count(DISTINCT u) INTO v_distintos FROM unnest(p_user_ids) AS u;
  IF v_distintos <> v_pedidos THEN
    RAISE EXCEPTION 'hay participantes repetidos en el grupo';
  END IF;

  SELECT target_number, session_id INTO v_target, v_session
    FROM sumate_rounds WHERE id = p_round_id AND status = 'playing'
    FOR UPDATE;
  IF v_target IS NULL THEN
    RAISE EXCEPTION 'la ronda no está abierta';
  END IF;

  SELECT count(*), coalesce(sum(assigned_number), 0)
    INTO v_hallados, v_sum
    FROM sumate_assignments
   WHERE round_id = p_round_id AND user_id = ANY(p_user_ids);

  IF v_hallados <> v_pedidos THEN
    RAISE EXCEPTION 'alguno de los seleccionados no tiene número en esta ronda';
  END IF;

  IF v_sum <> v_target THEN
    RETURN jsonb_build_object('ok', false, 'sum', v_sum, 'target', v_target);
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
           'user_id',         a.user_id,
           'name',            coalesce(cu.name, 'Jugador'),
           'avatar_emoji',    cu.avatar_emoji,
           'assigned_number', a.assigned_number
         ) ORDER BY a.assigned_number DESC)
    INTO v_group
    FROM sumate_assignments a
    LEFT JOIN connected_users cu
           ON cu.user_id = a.user_id AND cu.session_id = v_session
   WHERE a.round_id = p_round_id AND a.user_id = ANY(p_user_ids);

  UPDATE sumate_rounds
     SET status = 'finished', winner_group = v_group, finished_at = now()
   WHERE id = p_round_id AND status = 'playing';
  GET DIAGNOSTICS v_filas = ROW_COUNT;
  IF v_filas = 0 THEN
    RAISE EXCEPTION 'la ronda ya fue cerrada por otro administrador';
  END IF;

  RETURN jsonb_build_object('ok', true, 'sum', v_sum, 'target', v_target, 'winner_group', v_group);
END $$;

REVOKE ALL ON FUNCTION public.validate_sumate_group(uuid, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_sumate_group(uuid, uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.validate_sumate_group(uuid, uuid[]) TO authenticated;

-- ── 7) Cancelar ronda ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sumate_cancel_round(p_round_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'solo un administrador puede cerrar la ronda';
  END IF;
  UPDATE sumate_rounds
     SET status = 'cancelled', finished_at = now()
   WHERE id = p_round_id AND status = 'playing';
END $$;

REVOKE ALL ON FUNCTION public.sumate_cancel_round(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sumate_cancel_round(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.sumate_cancel_round(uuid) TO authenticated;

-- ── 8) Realtime ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                  WHERE pubname='supabase_realtime' AND schemaname='public'
                    AND tablename='sumate_rounds') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.sumate_rounds';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                  WHERE pubname='supabase_realtime' AND schemaname='public'
                    AND tablename='sumate_assignments') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.sumate_assignments';
  END IF;
END $$;
