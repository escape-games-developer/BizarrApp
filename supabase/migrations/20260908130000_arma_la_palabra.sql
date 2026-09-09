-- ============================================================================
-- ARMA LA PALABRA — ronda multiusuario con una letra por persona
--
-- Mismo contrato operativo que Sumate que Sumamos (presencia por
-- connected_users, dato individual por ronda, Realtime, validación
-- server-side, refresh reconstruible). Lo que cambia es la mecánica:
--   · Sumate  → número por persona, objetivo NUMÉRICO derivado del servidor
--   · Palabra → letra por persona, palabra objetivo que ESCRIBE EL OPERADOR
--
-- La solución está garantizada por construcción: las letras de la palabra se
-- reparten enteras entre N personas distintas (N = largo de la palabra) y el
-- resto de los conectados recibe una letra señuelo. Quiénes recibieron la
-- palabra "original" NO se guarda ni se devuelve: cualquier combinación válida
-- puede ganar.
--
-- Diferencia clave con Sumate en la validación: acá IMPORTA EL ORDEN. El admin
-- manda los user_ids en el orden en que la gente se paró, y el servidor
-- reconstruye la palabra respetando ese orden.
-- ============================================================================

-- ── 1) Rondas ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.arma_palabra_rounds (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid        NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  -- Normalizada por el RPC: mayúsculas, sin acentos, sin espacios, con Ñ.
  target_word  text        NOT NULL CHECK (target_word ~ '^[A-ZÑ]{3,12}$'),
  status       text        NOT NULL DEFAULT 'playing'
                           CHECK (status IN ('playing','finished','cancelled')),
  -- Snapshot del grupo ganador EN ORDEN: [{user_id, name, avatar_emoji,
  -- assigned_letter, pos}]. Es lo que pinta la TV.
  winner_group jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  finished_at  timestamptz
);

COMMENT ON TABLE  public.arma_palabra_rounds IS
  'Rondas de Arma la Palabra. La palabra la escribe el operador; las letras las reparte el servidor.';
COMMENT ON COLUMN public.arma_palabra_rounds.winner_group IS
  'Snapshot ORDENADO del grupo validado. NULL mientras la ronda sigue abierta.';

CREATE INDEX IF NOT EXISTS arma_palabra_rounds_session_idx
  ON public.arma_palabra_rounds (session_id, created_at DESC);
-- Una sola ronda viva por sesión, aunque dos admins toquen "Lanzar" a la vez.
CREATE UNIQUE INDEX IF NOT EXISTS arma_palabra_rounds_una_viva_idx
  ON public.arma_palabra_rounds (session_id) WHERE status = 'playing';

-- ── 2) Letras por persona ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.arma_palabra_assignments (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id        uuid        NOT NULL REFERENCES public.arma_palabra_rounds(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_letter text        NOT NULL CHECK (assigned_letter ~ '^[A-ZÑ]$'),
  created_at      timestamptz NOT NULL DEFAULT now(),
  -- Mismo usuario + misma ronda = SIEMPRE la misma letra. Cubre el F5, las dos
  -- pestañas y el reintento del RPC.
  UNIQUE (round_id, user_id)
);

CREATE INDEX IF NOT EXISTS arma_palabra_assignments_round_idx
  ON public.arma_palabra_assignments (round_id);

-- ── 3) RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE public.arma_palabra_rounds      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arma_palabra_assignments ENABLE ROW LEVEL SECURITY;

-- La ronda es pública: el celular necesita saber que existe y la TV necesita
-- la palabra. (El celular NO la renderiza: la palabra vive en la pantalla
-- gigante, igual que el objetivo de Sumate.)
DROP POLICY IF EXISTS "arma_palabra_rounds: todos leen" ON public.arma_palabra_rounds;
CREATE POLICY "arma_palabra_rounds: todos leen"
  ON public.arma_palabra_rounds FOR SELECT USING (true);

-- Cada cliente ve SÓLO su letra. Si esto fuera público, un celular podría
-- listar quién tiene cada letra y armar la palabra desde la mesa.
DROP POLICY IF EXISTS "arma_palabra_assignments: cada uno ve la suya" ON public.arma_palabra_assignments;
CREATE POLICY "arma_palabra_assignments: cada uno ve la suya"
  ON public.arma_palabra_assignments FOR SELECT
  USING (user_id = auth.uid());

-- El admin lee todas: es quien arma y valida el grupo. SÓLO LECTURA — con una
-- policy de escritura podría cambiarle la letra a cualquiera desde la API de
-- tablas, que es justo lo que el RPC de validación viene a impedir.
DROP POLICY IF EXISTS "arma_palabra_assignments: admin ve todas" ON public.arma_palabra_assignments;
CREATE POLICY "arma_palabra_assignments: admin ve todas"
  ON public.arma_palabra_assignments FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- NO hay ninguna policy de INSERT/UPDATE/DELETE sobre ninguna de las dos
-- tablas, para nadie: todas las escrituras pasan por los RPC SECURITY DEFINER.

-- ── 3b) Privilegios de tabla explícitos ─────────────────────────────────────
-- Se revoca TODO primero y después se concede sólo el SELECT que hace falta:
-- así el estado final no depende de qué privilegios hubiera de antes ni de los
-- ALTER DEFAULT PRIVILEGES del proyecto. RLS filtra FILAS, los grants filtran
-- VERBOS. La TV entra sin sesión (rol `anon`).
REVOKE ALL PRIVILEGES ON TABLE public.arma_palabra_rounds
  FROM anon, authenticated;

GRANT SELECT ON TABLE public.arma_palabra_rounds
  TO anon, authenticated;

-- `anon` no queda con nada sobre assignments: sin sesión no hay auth.uid()
-- contra el que filtrar, así que no tiene nada legítimo que ver ahí.
REVOKE ALL PRIVILEGES ON TABLE public.arma_palabra_assignments
  FROM anon, authenticated;

GRANT SELECT ON TABLE public.arma_palabra_assignments
  TO authenticated;

-- ── 4) Normalización de la palabra ──────────────────────────────────────────
-- Mayúsculas, sin acentos (Ñ se conserva), sin espacios alrededor. Se usa
-- `translate` y no `unaccent` para no depender de una extensión que puede no
-- estar instalada. Es IMMUTABLE y sin efectos: sirve también para validar
-- desde el panel antes de lanzar.
CREATE OR REPLACE FUNCTION public.arma_palabra_normalizar(p_word text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT translate(
           upper(btrim(coalesce(p_word, ''))),
           'ÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛ',
           'AAAAAEEEEIIIIOOOOOUUUU'
         );
$$;

REVOKE ALL ON FUNCTION public.arma_palabra_normalizar(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.arma_palabra_normalizar(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.arma_palabra_normalizar(text) TO authenticated;

-- ── 5) Lanzar ronda ─────────────────────────────────────────────────────────
-- Participantes elegibles = los que hicieron heartbeat en los últimos 2
-- minutos, la MISMA ventana de presencia que ya usan Rey del Orto y Sumate
-- (connected_users.last_seen). No se inventa una presencia nueva.
--
-- Columnas de public.connected_users usadas acá y en la validación:
-- session_id, user_id, last_seen, name, avatar_emoji. Confirmadas en el schema
-- local (supabase/schema.sql, CREATE TABLE connected_users); las escribe
-- usePresence.js y las lee el panel de Rey del Orto.
CREATE OR REPLACE FUNCTION public.arma_palabra_launch_round(p_session uuid, p_target_word text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_round uuid;
  v_word  text;
  v_len   int;
  v_n     int;
  v_users uuid[];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'solo un administrador puede lanzar la ronda';
  END IF;

  v_word := arma_palabra_normalizar(p_target_word);
  IF v_word !~ '^[A-ZÑ]{3,12}$' THEN
    RAISE EXCEPTION 'la palabra debe tener entre 3 y 12 letras, sin espacios ni signos (recibí "%")', v_word;
  END IF;
  v_len := length(v_word);

  -- Los conectados de la ventana, YA MEZCLADOS. Se materializan una sola vez:
  -- la lista que decide si alcanza la gente tiene que ser la misma que recibe
  -- las letras, o la palabra podría quedar repartida a medias.
  SELECT array_agg(cu.user_id ORDER BY random())
    INTO v_users
    FROM connected_users cu
   WHERE cu.session_id = p_session
     AND cu.last_seen > now() - interval '2 minutes';

  v_n := coalesce(array_length(v_users, 1), 0);
  IF v_n < v_len THEN
    RAISE EXCEPTION 'necesitás al menos % participantes conectados (hay %)', v_len, v_n;
  END IF;

  -- Cierra la ronda anterior de la sesión: sin esto choca el índice de "una
  -- viva por sesión".
  UPDATE arma_palabra_rounds
     SET status = 'cancelled', finished_at = now()
   WHERE session_id = p_session AND status = 'playing';

  INSERT INTO arma_palabra_rounds (session_id, target_word, status)
  VALUES (p_session, v_word, 'playing')
  RETURNING id INTO v_round;

  -- Los primeros v_len del array mezclado se llevan las letras de la palabra
  -- EN ORDEN (posición i → i-ésima letra); el resto recibe un señuelo. Así
  -- existe siempre al menos una combinación ganadora, y quiénes son NO queda
  -- registrado en ningún lado.
  INSERT INTO arma_palabra_assignments (round_id, user_id, assigned_letter)
  SELECT v_round,
         t.u,
         CASE WHEN t.ord <= v_len
              THEN substr(v_word, t.ord::int, 1)
              ELSE chr(65 + floor(random() * 26)::int)
         END
    FROM unnest(v_users) WITH ORDINALITY AS t(u, ord);

  RETURN jsonb_build_object(
    'round_id',     v_round,
    'target_word',  v_word,
    'letters',      v_len,
    'participants', v_n
  );
END $$;

REVOKE ALL ON FUNCTION public.arma_palabra_launch_round(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.arma_palabra_launch_round(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.arma_palabra_launch_round(uuid, text) TO authenticated;

-- ── 6) Letra del que entra tarde ────────────────────────────────────────────
-- El que abre la app con la ronda empezada recibe un SEÑUELO aleatorio. No se
-- toca la palabra objetivo ni se redistribuyen las letras ya repartidas: la
-- combinación ganadora original sigue existiendo intacta.
--
-- Idempotente por el UNIQUE: dos pestañas, un F5 o diez llamadas devuelven
-- siempre la misma letra.
CREATE OR REPLACE FUNCTION public.arma_palabra_ensure_assignment(p_round uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user  uuid := auth.uid();
  v_letra text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM arma_palabra_rounds WHERE id = p_round AND status = 'playing') THEN
    RAISE EXCEPTION 'la ronda no está abierta';
  END IF;

  INSERT INTO arma_palabra_assignments (round_id, user_id, assigned_letter)
  VALUES (p_round, v_user, chr(65 + floor(random() * 26)::int))
  ON CONFLICT (round_id, user_id) DO NOTHING;

  SELECT assigned_letter INTO v_letra
    FROM arma_palabra_assignments WHERE round_id = p_round AND user_id = v_user;
  RETURN v_letra;
END $$;

REVOKE ALL ON FUNCTION public.arma_palabra_ensure_assignment(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.arma_palabra_ensure_assignment(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.arma_palabra_ensure_assignment(uuid) TO authenticated;

-- ── 7) Validar el grupo ─────────────────────────────────────────────────────
-- El admin manda USUARIOS EN ORDEN, nunca letras: el servidor lee las letras
-- reales y reconstruye la palabra respetando ese orden. Un panel manipulado no
-- puede inventar un ganador.
CREATE OR REPLACE FUNCTION public.validate_arma_palabra_group(p_round_id uuid, p_user_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_word      text;
  v_formed    text;
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

  -- Sin repetidos: la misma persona no puede aportar dos letras. (Las LETRAS sí
  -- pueden repetirse — BIZARRA lleva dos A y dos R —, pero cada una tiene que
  -- venir de una persona distinta.) `count(DISTINCT)` ignora los NULL, así que
  -- un array con NULL también cae acá.
  SELECT count(DISTINCT u) INTO v_distintos FROM unnest(p_user_ids) AS u;
  IF v_pedidos = 0 OR v_distintos <> v_pedidos THEN
    RAISE EXCEPTION 'hay participantes repetidos o vacíos en el grupo';
  END IF;

  -- FOR UPDATE serializa a dos admins validando a la vez: el segundo espera al
  -- commit del primero y entonces ya no encuentra la ronda en 'playing'.
  SELECT target_word, session_id INTO v_word, v_session
    FROM arma_palabra_rounds WHERE id = p_round_id AND status = 'playing'
    FOR UPDATE;
  IF v_word IS NULL THEN
    RAISE EXCEPTION 'la ronda no está abierta';
  END IF;

  IF v_pedidos <> length(v_word) THEN
    RAISE EXCEPTION 'la palabra tiene % letras y seleccionaste % participantes', length(v_word), v_pedidos;
  END IF;

  -- WITH ORDINALITY conserva el ORDEN en que el admin seleccionó a la gente:
  -- es lo que diferencia BIZARRA de BZIARRA. Sólo assignments DE ESTA RONDA.
  SELECT count(*), string_agg(a.assigned_letter, '' ORDER BY t.ord)
    INTO v_hallados, v_formed
    FROM unnest(p_user_ids) WITH ORDINALITY AS t(u, ord)
    JOIN arma_palabra_assignments a
      ON a.round_id = p_round_id AND a.user_id = t.u;

  IF v_hallados <> v_pedidos THEN
    RAISE EXCEPTION 'alguno de los seleccionados no tiene letra en esta ronda';
  END IF;

  IF v_formed IS DISTINCT FROM v_word THEN
    RETURN jsonb_build_object('ok', false, 'formed', v_formed, 'target', v_word);
  END IF;

  -- Snapshot ORDENADO del grupo, con el nombre y el avatar de la sesión.
  SELECT jsonb_agg(jsonb_build_object(
           'pos',             t.ord,
           'user_id',         a.user_id,
           'name',            coalesce(cu.name, 'Jugador'),
           'avatar_emoji',    cu.avatar_emoji,
           'assigned_letter', a.assigned_letter
         ) ORDER BY t.ord)
    INTO v_group
    FROM unnest(p_user_ids) WITH ORDINALITY AS t(u, ord)
    JOIN arma_palabra_assignments a
      ON a.round_id = p_round_id AND a.user_id = t.u
    LEFT JOIN connected_users cu
      ON cu.user_id = a.user_id AND cu.session_id = v_session;

  -- El guard de status hace el cierre idempotente: la ronda pasa de 'playing' a
  -- 'finished' UNA sola vez, y si no actualizó ninguna fila es que otro admin
  -- ganó la carrera — no se canta un segundo grupo ganador.
  UPDATE arma_palabra_rounds
     SET status = 'finished', winner_group = v_group, finished_at = now()
   WHERE id = p_round_id AND status = 'playing';
  GET DIAGNOSTICS v_filas = ROW_COUNT;
  IF v_filas = 0 THEN
    RAISE EXCEPTION 'la ronda ya fue cerrada por otro administrador';
  END IF;

  RETURN jsonb_build_object('ok', true, 'formed', v_formed, 'target', v_word, 'winner_group', v_group);
END $$;

REVOKE ALL ON FUNCTION public.validate_arma_palabra_group(uuid, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_arma_palabra_group(uuid, uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.validate_arma_palabra_group(uuid, uuid[]) TO authenticated;

-- ── 8) Cancelar ronda (cerrar el juego sin ganador) ─────────────────────────
CREATE OR REPLACE FUNCTION public.arma_palabra_cancel_round(p_round_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'solo un administrador puede cerrar la ronda';
  END IF;
  UPDATE arma_palabra_rounds
     SET status = 'cancelled', finished_at = now()
   WHERE id = p_round_id AND status = 'playing';
END $$;

REVOKE ALL ON FUNCTION public.arma_palabra_cancel_round(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.arma_palabra_cancel_round(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.arma_palabra_cancel_round(uuid) TO authenticated;

-- ── 9) Realtime ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                  WHERE pubname='supabase_realtime' AND schemaname='public'
                    AND tablename='arma_palabra_rounds') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.arma_palabra_rounds';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                  WHERE pubname='supabase_realtime' AND schemaname='public'
                    AND tablename='arma_palabra_assignments') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.arma_palabra_assignments';
  END IF;
END $$;
