-- ============================================================================
-- ARMA LA PALABRA — patch de reglas de palabra y reparto equitativo
--
-- Parche sobre 20260908130000_arma_la_palabra.sql, que YA está aplicada en
-- producción. No recrea tablas, no borra rondas, no toca otros juegos.
--
-- Qué cambia:
--   1. La palabra pasa de 3..12 a 3..6 letras y no puede repetir letras.
--   2. El reparto deja de dar letras señuelo A-Z: TODOS reciben una letra de
--      la palabra, repartidas lo más parejo posible (diferencia <= 1 entre la
--      letra más y la menos entregada).
--   3. El que entra tarde recibe una de las letras MENOS entregadas, no una al
--      azar: así el equilibrio se mantiene mientras la ronda crece.
--
-- Invariantes que quedan garantizados después de un launch o de un late join:
--   A) toda assigned_letter pertenece a target_word
--   B) un usuario, una letra          (UNIQUE (round_id, user_id), ya existía)
--   C) toda letra de la palabra aparece al menos una vez  (N >= L + base >= 1)
--   D) max(veces) - min(veces) <= 1
--   E) ninguna letra externa a la palabra
-- ============================================================================

-- ── 1) Validación de la palabra ─────────────────────────────────────────────
-- IMMUTABLE para poder usarla dentro de un CHECK. Dos condiciones: forma
-- (3 a 6 letras A-Z/Ñ, sin espacios ni signos) y unicidad de las letras.
--
-- La unicidad no es un capricho de diseño: con letras repetidas, "cada letra
-- aparece al menos una vez" dejaría de garantizar que la palabra se puede
-- armar (CASA necesita DOS A, no una).
CREATE OR REPLACE FUNCTION public.arma_palabra_valida(p_word text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
AS $$
  SELECT coalesce(p_word, '') ~ '^[A-ZÑ]{3,6}$'
     AND length(p_word) = (
           SELECT count(DISTINCT c) FROM regexp_split_to_table(p_word, '') AS c
         );
$$;

REVOKE ALL ON FUNCTION public.arma_palabra_valida(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.arma_palabra_valida(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.arma_palabra_valida(text) TO authenticated;

-- El CHECK viejo era `^[A-ZÑ]{3,12}$` inline en la columna. Se reemplaza por la
-- función. NOT VALID a propósito: las rondas YA jugadas pueden tener palabras
-- de 7+ letras o con letras repetidas y no hay por qué invalidar el histórico
-- — la restricción rige para todo lo que se inserte de acá en adelante.
ALTER TABLE public.arma_palabra_rounds
  DROP CONSTRAINT IF EXISTS arma_palabra_rounds_target_word_check;

ALTER TABLE public.arma_palabra_rounds
  ADD CONSTRAINT arma_palabra_rounds_target_word_check
  CHECK (public.arma_palabra_valida(target_word)) NOT VALID;

-- ── 2) Lanzar ronda — reparto equitativo ────────────────────────────────────
-- Reemplaza la versión anterior (letras de la palabra una vez + señuelos A-Z).
--
-- El reparto: con N participantes y L letras,
--     base  = N / L        (división entera)
--     resto = N % L
-- cada letra sale `base` veces y exactamente `resto` letras —elegidas al azar—
-- salen una vez más. De ahí sale D) directo: todas las cuentas son base o
-- base+1. Y como N >= L obliga a base >= 1, ninguna letra queda sin repartir,
-- que es C).
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
  v_base  int;
  v_resto int;
  v_users uuid[];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'solo un administrador puede lanzar la ronda';
  END IF;

  v_word := arma_palabra_normalizar(p_target_word);
  IF NOT arma_palabra_valida(v_word) THEN
    RAISE EXCEPTION
      'la palabra debe tener entre 3 y 6 letras distintas, sin espacios ni signos (recibí "%")', v_word;
  END IF;
  v_len := length(v_word);

  -- Los conectados de la ventana, YA MEZCLADOS. Se materializan una sola vez:
  -- la lista que decide si alcanza la gente tiene que ser la misma que recibe
  -- las letras.
  SELECT array_agg(cu.user_id ORDER BY random())
    INTO v_users
    FROM connected_users cu
   WHERE cu.session_id = p_session
     AND cu.last_seen > now() - interval '2 minutes';

  v_n := coalesce(array_length(v_users, 1), 0);
  IF v_n < v_len THEN
    RAISE EXCEPTION 'necesitás al menos % participantes conectados (hay %)', v_len, v_n;
  END IF;

  v_base  := v_n / v_len;
  v_resto := v_n % v_len;

  UPDATE arma_palabra_rounds
     SET status = 'cancelled', finished_at = now()
   WHERE session_id = p_session AND status = 'playing';

  INSERT INTO arma_palabra_rounds (session_id, target_word, status)
  VALUES (p_session, v_word, 'playing')
  RETURNING id INTO v_round;

  -- `letras`: las L letras de la palabra, barajadas — el orden aleatorio es lo
  --           que decide CUÁLES reciben la copia extra.
  -- `cupos` : cuántas veces sale cada una.
  -- `pool`  : las N letras expandidas y barajadas de nuevo, para que la letra
  --           que toca no dependa de la posición del usuario en la lista.
  WITH letras AS (
    SELECT substr(v_word, g.i, 1) AS letra,
           row_number() OVER (ORDER BY random()) AS rnd
      FROM generate_series(1, v_len) AS g(i)
  ),
  cupos AS (
    SELECT letra, v_base + CASE WHEN rnd <= v_resto THEN 1 ELSE 0 END AS veces
      FROM letras
  ),
  pool AS (
    SELECT c.letra, row_number() OVER (ORDER BY random()) AS pos
      FROM cupos c, generate_series(1, c.veces)
  )
  INSERT INTO arma_palabra_assignments (round_id, user_id, assigned_letter)
  SELECT v_round, t.u, p.letra
    FROM unnest(v_users) WITH ORDINALITY AS t(u, ord)
    JOIN pool p ON p.pos = t.ord;

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

-- ── 3) Letra del que entra tarde — la menos entregada ───────────────────────
-- Reemplaza el señuelo aleatorio. Se cuenta cuántas veces salió cada letra de
-- la palabra y se entrega una de las que menos aparecen (al azar entre las
-- empatadas), así el reparto sigue cumpliendo D) a medida que llega gente.
--
-- El FOR UPDATE sobre la ronda serializa a dos personas que entran al mismo
-- tiempo: sin él las dos leerían el mismo conteo y podrían llevarse la misma
-- letra, desbalanceando en 2.
CREATE OR REPLACE FUNCTION public.arma_palabra_ensure_assignment(p_round uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user  uuid := auth.uid();
  v_word  text;
  v_letra text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  -- Si ya tengo letra, ni se toca el conteo: idempotencia primero (dos
  -- pestañas, un F5, un reintento).
  SELECT assigned_letter INTO v_letra
    FROM arma_palabra_assignments WHERE round_id = p_round AND user_id = v_user;
  IF v_letra IS NOT NULL THEN RETURN v_letra; END IF;

  SELECT target_word INTO v_word
    FROM arma_palabra_rounds WHERE id = p_round AND status = 'playing'
    FOR UPDATE;
  IF v_word IS NULL THEN
    RAISE EXCEPTION 'la ronda no está abierta';
  END IF;

  WITH letras AS (
    SELECT substr(v_word, g.i, 1) AS letra
      FROM generate_series(1, length(v_word)) AS g(i)
  ),
  conteo AS (
    SELECT l.letra, count(a.user_id) AS veces
      FROM letras l
      LEFT JOIN arma_palabra_assignments a
        ON a.round_id = p_round AND a.assigned_letter = l.letra
     GROUP BY l.letra
  )
  SELECT letra INTO v_letra
    FROM conteo ORDER BY veces ASC, random() LIMIT 1;

  INSERT INTO arma_palabra_assignments (round_id, user_id, assigned_letter)
  VALUES (p_round, v_user, v_letra)
  ON CONFLICT (round_id, user_id) DO NOTHING;

  -- Se relee: si otra pestaña ganó la carrera, vale la letra que quedó.
  SELECT assigned_letter INTO v_letra
    FROM arma_palabra_assignments WHERE round_id = p_round AND user_id = v_user;
  RETURN v_letra;
END $$;

REVOKE ALL ON FUNCTION public.arma_palabra_ensure_assignment(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.arma_palabra_ensure_assignment(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.arma_palabra_ensure_assignment(uuid) TO authenticated;

-- `validate_arma_palabra_group` NO se toca: la validación por orden sigue
-- exactamente igual, y que ahora haya varias personas con la misma letra no la
-- afecta — cualquier conjunto de usuarios DISTINTOS que forme la palabra gana.
