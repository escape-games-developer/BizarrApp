-- Arma la Palabra · Reglas configurables V1 (participantes_minimos)
-- - Tabla arma_palabra_reglas_config (patrón rey/sumate_reglas_config, independiente).
-- - arma_palabra_launch_round lee la regla y aplica:
--     ON  → required = GREATEST(length(palabra), min)
--     OFF → required = length(palabra)   (mínimo estructural, no desactivable)
-- - Reparto equitativo SIN cambios. Presencia SIN cambios (last_seen > now() - 2 min).
-- - Contrato compatible: éxito sigue siendo jsonb (se agregan campos); los rechazos
--   siguen siendo excepciones (el frontend actual hace `if (error) throw`), ahora con
--   código estable en HINT y JSON en DETAIL: {code, connected_count, required_count, ...}.

-- ─────────────────────────────────────────────────────────────
-- 1) Configuración
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.arma_palabra_reglas_config (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text        NOT NULL,
  enabled     boolean     NOT NULL DEFAULT true,
  value       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  updated_by  uuid        NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT arma_palabra_reglas_config_key_key UNIQUE (key),
  CONSTRAINT arma_palabra_reglas_config_key_formato CHECK (key ~ '^[a-z][a-z0-9_]{2,63}$'),
  CONSTRAINT arma_palabra_reglas_config_value_objeto CHECK (jsonb_typeof(value) = 'object'),
  CONSTRAINT arma_palabra_reglas_config_participantes_minimos_valido CHECK (
    key <> 'participantes_minimos' OR (
      CASE WHEN jsonb_typeof(value->'min') = 'number'
                AND (value - 'min') = '{}'::jsonb
                AND (value->>'min') ~ '^[1-9][0-9]*$'
           THEN (value->>'min')::int BETWEEN 1 AND 100
           ELSE false
      END))
);

COMMENT ON TABLE public.arma_palabra_reglas_config IS
  'Arma la Palabra: reglas operativas globales (una fila por regla). Keys definidas por migración; Admin sólo SELECT/UPDATE de enabled/value/updated_by. El valor se valida y se conserva aunque la regla esté apagada. El mínimo estructural (una persona por letra) vive en la RPC y no es configurable.';

CREATE TRIGGER arma_palabra_reglas_config_updated_at
  BEFORE UPDATE ON public.arma_palabra_reglas_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.arma_palabra_reglas_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "arma_palabra_reglas_config: admin lee"
  ON public.arma_palabra_reglas_config FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "arma_palabra_reglas_config: admin actualiza"
  ON public.arma_palabra_reglas_config FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

REVOKE ALL ON TABLE public.arma_palabra_reglas_config FROM PUBLIC;
REVOKE ALL ON TABLE public.arma_palabra_reglas_config FROM anon;
REVOKE ALL ON TABLE public.arma_palabra_reglas_config FROM authenticated;
GRANT SELECT ON TABLE public.arma_palabra_reglas_config TO authenticated;
GRANT UPDATE (enabled, value, updated_by) ON TABLE public.arma_palabra_reglas_config TO authenticated;

INSERT INTO public.arma_palabra_reglas_config (key, enabled, value) VALUES
  ('participantes_minimos', true, '{"min": 3}'::jsonb);

-- ─────────────────────────────────────────────────────────────
-- 2) Lanzamiento: el backend decide el mínimo
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.arma_palabra_launch_round(p_session uuid, p_target_word text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_word           text;
  v_len            int;
  v_letters        text[];
  v_users          uuid[];
  v_n              int;
  v_base           int;
  v_resto          int;
  v_freq           int[];
  v_final_letters  text[];
  v_round          uuid;
  v_cfg_on         boolean;
  v_cfg_val        jsonb;
  v_cfg_min        int;
  v_required       int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'solo un administrador puede lanzar la ronda'
      USING HINT = 'UNAUTHORIZED', DETAIL = jsonb_build_object('code', 'UNAUTHORIZED')::text;
  END IF;

  v_word := public.arma_palabra_normalizar(p_target_word);
  IF v_word IS NULL THEN
    RAISE EXCEPTION 'palabra inválida: usar 3–6 letras (A–Z o Ñ), sin espacios, números, signos ni letras repetidas'
      USING HINT = 'INVALID_WORD', DETAIL = jsonb_build_object('code', 'INVALID_WORD')::text;
  END IF;
  v_len := length(v_word);

  -- Regla configurable (búsqueda por key; sin defaults silenciosos).
  SELECT enabled, value INTO v_cfg_on, v_cfg_val
    FROM arma_palabra_reglas_config WHERE key = 'participantes_minimos';
  IF NOT FOUND
     OR (v_cfg_on AND (jsonb_typeof(v_cfg_val -> 'min') IS DISTINCT FROM 'number'
                       OR (v_cfg_val ->> 'min') !~ '^[1-9][0-9]*$')) THEN
    RAISE EXCEPTION 'falta o es inválida la regla participantes_minimos'
      USING HINT = 'CONFIG_INCOMPLETE', DETAIL = jsonb_build_object('code', 'CONFIG_INCOMPLETE')::text;
  END IF;
  IF v_cfg_on THEN
    v_cfg_min := (v_cfg_val ->> 'min')::int;
  END IF;
  -- Mínimo estructural (una persona por letra) + mínimo configurable si está ON.
  v_required := GREATEST(v_len, coalesce(v_cfg_min, 0));

  -- Descompongo y BARAJO las letras: el orden decide qué letras reciben la
  -- copia extra cuando N no es múltiplo de L.
  SELECT array_agg(l ORDER BY random())
    INTO v_letters
    FROM (
      SELECT substring(v_word FROM g FOR 1) AS l
        FROM generate_series(1, v_len) g
    ) t;

  -- Presentes (heartbeat 2 min, misma ventana que el resto)
  SELECT array_agg(cu.user_id ORDER BY random())
    INTO v_users
    FROM connected_users cu
   WHERE cu.session_id = p_session
     AND cu.last_seen > now() - interval '2 minutes';

  v_n := coalesce(array_length(v_users, 1), 0);
  IF v_n < v_required THEN
    RAISE EXCEPTION 'se necesitan al menos % participantes conectados (hay %)', v_required, v_n
      USING HINT = 'MIN_PARTICIPANTS',
            DETAIL = jsonb_build_object(
              'code', 'MIN_PARTICIPANTS',
              'connected_count', v_n,
              'required_count', v_required,
              'word_length', v_len,
              'configured_min', v_cfg_min,
              'min_participants_enabled', v_cfg_on)::text;
  END IF;

  UPDATE arma_palabra_rounds
     SET status = 'cancelled', finished_at = now()
   WHERE session_id = p_session AND status = 'playing';

  -- Reparto equitativo: primeras v_resto letras del array barajado obtienen
  -- v_base+1 copias, el resto obtienen v_base. |max-min| <= 1 por construcción.
  v_base  := v_n / v_len;
  v_resto := v_n % v_len;

  v_freq := ARRAY(
    SELECT CASE WHEN i <= v_resto THEN v_base + 1 ELSE v_base END
      FROM generate_series(1, v_len) AS i
  );

  -- Construyo el pool final expandiendo cada letra su freq y lo barajo.
  SELECT array_agg(letter ORDER BY random())
    INTO v_final_letters
    FROM (
      SELECT u.letter
        FROM unnest(v_letters, v_freq) AS u(letter, freq),
             LATERAL generate_series(1, u.freq) g
    ) s;

  INSERT INTO arma_palabra_rounds (session_id, target_word, status)
  VALUES (p_session, v_word, 'playing')
  RETURNING id INTO v_round;

  -- v_users y v_final_letters están ambos barajados: ningún vínculo predecible
  -- entre "usuario i" y "posición de letra en la palabra".
  INSERT INTO arma_palabra_assignments (round_id, user_id, assigned_letter)
  SELECT v_round, v_users[i], v_final_letters[i]
    FROM generate_series(1, v_n) AS i;

  RETURN jsonb_build_object(
    'round_id',                 v_round,
    'word_length',              v_len,
    'participants',             v_n,
    'base',                     v_base,
    'resto',                    v_resto,
    'required_count',           v_required,
    'configured_min',           v_cfg_min,
    'min_participants_enabled', v_cfg_on
  );
END $$;

REVOKE ALL ON FUNCTION public.arma_palabra_launch_round(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.arma_palabra_launch_round(uuid, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.arma_palabra_launch_round(uuid, text) IS
  'Arma la Palabra V1: required = GREATEST(length(palabra), participantes_minimos.min si ON). Rechazos como excepción con HINT=código y DETAIL=JSON {code, connected_count, required_count, ...}. Reparto equitativo sin cambios.';
