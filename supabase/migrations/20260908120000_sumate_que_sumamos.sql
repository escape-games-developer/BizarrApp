-- ============================================================================
-- SUMATE QUE SUMAMOS — ronda multiusuario con número por persona
--
-- Mecánica: el operador lanza la ronda, el SERVIDOR le asigna a cada usuario
-- conectado un número del 1 al 9 y publica un objetivo. La gente se busca
-- físicamente en el bar y forma un grupo cuya suma dé exacto. El operador
-- valida al grupo.
--
-- Por qué backend y no `game_state.minijuego_payload`: ese JSON es UNO para
-- toda la sesión, así que un `assigned_number` ahí se lo comen todos los
-- celulares iguales — que es exactamente lo que estaba roto. El número tiene
-- que ser POR (ronda, usuario), y el cliente no puede poder cambiarlo.
--
-- El objetivo NO es aleatorio: se calcula sumando entre 3 y 5 assignments
-- reales (2 si hay sólo dos jugadores), así siempre existe al menos una
-- solución. Qué combinación se usó NO se expone a nadie: puede haber varias
-- válidas y descubrir una es el juego.
-- ============================================================================

-- ── 1) Rondas ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sumate_rounds (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid        NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  target_number int         NOT NULL CHECK (target_number > 0),
  status        text        NOT NULL DEFAULT 'playing'
                            CHECK (status IN ('playing','finished','cancelled')),
  -- Snapshot denormalizado del grupo ganador (mismo patrón que los slots del
  -- Duelo): [{user_id, name, avatar_emoji, assigned_number}]. Es lo que pinta
  -- la TV, y sobrevive aunque después cambien las filas de origen.
  winner_group  jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz
);

COMMENT ON TABLE  public.sumate_rounds IS
  'Rondas de Sumate que Sumamos. El objetivo se deriva de assignments reales: siempre tiene solución.';
COMMENT ON COLUMN public.sumate_rounds.winner_group IS
  'Snapshot del grupo validado. NULL mientras la ronda sigue abierta.';

CREATE INDEX IF NOT EXISTS sumate_rounds_session_idx ON public.sumate_rounds (session_id, created_at DESC);
-- Una sola ronda viva por sesión: el índice parcial lo hace imposible de violar
-- aunque dos admins toquen "Lanzar" al mismo tiempo.
CREATE UNIQUE INDEX IF NOT EXISTS sumate_rounds_una_viva_idx
  ON public.sumate_rounds (session_id) WHERE status = 'playing';

-- ── 2) Números por persona ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sumate_assignments (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id        uuid        NOT NULL REFERENCES public.sumate_rounds(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_number int         NOT NULL CHECK (assigned_number BETWEEN 1 AND 9),
  created_at      timestamptz NOT NULL DEFAULT now(),
  -- La clave del contrato: mismo usuario + misma ronda = SIEMPRE el mismo
  -- número. Cubre el F5, las dos pestañas y el reintento del RPC.
  UNIQUE (round_id, user_id)
);

CREATE INDEX IF NOT EXISTS sumate_assignments_round_idx ON public.sumate_assignments (round_id);

-- ── 3) RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE public.sumate_rounds      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sumate_assignments ENABLE ROW LEVEL SECURITY;

-- La ronda es pública: el celular y la TV necesitan el objetivo y el estado.
DROP POLICY IF EXISTS "sumate_rounds: todos leen" ON public.sumate_rounds;
CREATE POLICY "sumate_rounds: todos leen"
  ON public.sumate_rounds FOR SELECT USING (true);

DROP POLICY IF EXISTS "sumate_rounds: admin gestiona" ON public.sumate_rounds;
CREATE POLICY "sumate_rounds: admin gestiona"
  ON public.sumate_rounds FOR ALL
  USING      (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- Cada cliente ve SÓLO su número. Si esto fuera público, el celular podría
-- listar "Marce 7 · Juan 3 · Sofi 9" y se acabó el juego: la gracia es tener
-- que encontrarse en el bar.
DROP POLICY IF EXISTS "sumate_assignments: cada uno ve el suyo" ON public.sumate_assignments;
CREATE POLICY "sumate_assignments: cada uno ve el suyo"
  ON public.sumate_assignments FOR SELECT
  USING (user_id = auth.uid());

-- El admin ve todos: es quien valida los grupos. SÓLO LECTURA — con FOR ALL
-- podía cambiarle el assigned_number a cualquiera desde la API de tablas, que
-- es exactamente el fraude que el RPC de validación viene a impedir.
DROP POLICY IF EXISTS "sumate_assignments: admin ve todos" ON public.sumate_assignments;
CREATE POLICY "sumate_assignments: admin ve todos"
  ON public.sumate_assignments FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- NO hay ninguna policy de INSERT/UPDATE/DELETE sobre assignments, para nadie:
-- los números se crean únicamente por RPC. Nadie puede elegirse el suyo ni
-- tocarle el de otro.

-- ── 3b) Privilegios de tabla explícitos ─────────────────────────────────────
-- No se depende de los ALTER DEFAULT PRIVILEGES del proyecto: se declara acá
-- el mínimo que hace falta. RLS filtra FILAS, los grants filtran VERBOS — sin
-- estos REVOKE, una policy nueva o un default distinto podría abrir escrituras
-- por la puerta de atrás.
--
-- La TV entra sin sesión (rol `anon`) y necesita leer el objetivo y el
-- ganador; el celular y el panel son `authenticated`. Las escrituras las hacen
-- los cuatro RPC SECURITY DEFINER, que corren como el owner y no dependen de
-- estos privilegios.
-- Se revoca TODO primero y después se concede sólo el SELECT que hace falta:
-- así el estado final no depende de qué privilegios hubiera de antes.
REVOKE ALL PRIVILEGES ON TABLE public.sumate_rounds
  FROM anon, authenticated;

GRANT SELECT ON TABLE public.sumate_rounds
  TO anon, authenticated;

-- `anon` no queda con nada sobre assignments: sin sesión no hay auth.uid()
-- contra el que filtrar, así que no tiene nada legítimo que ver ahí.
REVOKE ALL PRIVILEGES ON TABLE public.sumate_assignments
  FROM anon, authenticated;

GRANT SELECT ON TABLE public.sumate_assignments
  TO authenticated;

-- ── 4) Lanzar ronda ─────────────────────────────────────────────────────────
-- Participantes elegibles = los que hicieron heartbeat en los últimos 2
-- minutos, la MISMA ventana de presencia que ya usa Rey del Orto
-- (connected_users.last_seen). No se inventa una presencia nueva.
--
-- Columnas de public.connected_users usadas acá y en validate_sumate_group:
-- session_id, user_id, last_seen, name, avatar_emoji. Están confirmadas en el
-- schema local (supabase/schema.sql, CREATE TABLE connected_users), las
-- escribe usePresence.js y las lee el panel de Rey del Orto. Si el remoto
-- hubiera derivado del schema local, verificarlas antes de aplicar.
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

  -- Los conectados de la ventana, con su número ya sorteado. Se materializa
  -- UNA sola vez en dos arrays paralelos: si se volviera a sortear más abajo,
  -- el objetivo se calcularía con números distintos a los que quedan guardados
  -- y la ronda podría no tener solución.
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

  -- Cierra la ronda anterior de la sesión: sin esto choca el índice de "una
  -- viva por sesión".
  UPDATE sumate_rounds
     SET status = 'cancelled', finished_at = now()
   WHERE session_id = p_session AND status = 'playing';

  -- Cuántos jugadores entran en el objetivo: entre 3 y 5 para que no sea
  -- trivial; con sólo dos conectados, los dos.
  v_k := CASE WHEN v_n >= 3
              THEN 3 + floor(random() * (LEAST(5, v_n) - 2))::int
              ELSE 2 END;

  -- El objetivo ES la suma de k números REALES ya repartidos → existe al menos
  -- una solución. Qué k se eligieron no se guarda en ningún lado.
  SELECT sum(n) INTO v_target
    FROM (SELECT unnest(v_nums) AS n ORDER BY random() LIMIT v_k) s;

  INSERT INTO sumate_rounds (session_id, target_number, status)
  VALUES (p_session, v_target, 'playing')
  RETURNING id INTO v_round;

  INSERT INTO sumate_assignments (round_id, user_id, assigned_number)
  SELECT v_round, u, n FROM unnest(v_users, v_nums) AS t(u, n);

  -- La combinación usada NO se devuelve ni se guarda: puede haber varias
  -- válidas y descubrir una es el juego.
  RETURN jsonb_build_object(
    'round_id', v_round,
    'target_number', v_target,
    'participants', v_n
  );
END $$;

REVOKE ALL ON FUNCTION public.sumate_launch_round(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sumate_launch_round(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.sumate_launch_round(uuid) TO authenticated;

-- ── 5) Número del que entra tarde ───────────────────────────────────────────
-- Idempotente por el UNIQUE: dos pestañas, un F5 o diez llamadas devuelven
-- siempre el mismo número. El que llega con la ronda empezada juega igual —
-- su número no cambia el objetivo, sólo agrega combinaciones posibles.
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
-- El admin manda USUARIOS, nunca números: el servidor lee los assignments
-- reales y suma él. Un panel manipulado no puede inventar un ganador.
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

  -- La mecánica es JUNTARSE: una sola persona no puede ganar aunque su número
  -- coincida con el objetivo.
  IF v_pedidos < 2 THEN
    RAISE EXCEPTION 'el grupo debe tener al menos 2 participantes';
  END IF;

  -- Sin repetidos: [A, A, B] sumaría el número de A dos veces y podría llegar
  -- al objetivo con dos personas en vez de tres. `count(DISTINCT)` ignora los
  -- NULL, así que un array con NULL también cae acá.
  SELECT count(DISTINCT u) INTO v_distintos FROM unnest(p_user_ids) AS u;
  IF v_distintos <> v_pedidos THEN
    RAISE EXCEPTION 'hay participantes repetidos en el grupo';
  END IF;

  -- FOR UPDATE serializa a dos admins validando a la vez: el segundo espera al
  -- commit del primero y entonces ya no encuentra la ronda en 'playing'.
  SELECT target_number, session_id INTO v_target, v_session
    FROM sumate_rounds WHERE id = p_round_id AND status = 'playing'
    FOR UPDATE;
  IF v_target IS NULL THEN
    RAISE EXCEPTION 'la ronda no está abierta';
  END IF;

  -- Sólo assignments DE ESTA RONDA: un user_id de otra ronda no suma.
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

  -- Snapshot del grupo, con el nombre y el avatar que tenía en la sesión.
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

  -- El guard de status hace el cierre idempotente: la ronda pasa de 'playing' a
  -- 'finished' UNA sola vez, y si no actualizó ninguna fila es que otro admin
  -- ganó la carrera — no se canta un segundo grupo ganador.
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

-- ── 7) Cancelar ronda (cerrar el juego sin ganador) ─────────────────────────
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
