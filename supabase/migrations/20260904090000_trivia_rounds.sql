-- Trivia reproducible por ronda. Las respuestas correctas permanecen en una
-- tabla protegida y las vistas publicas solo revelan resultados fuera de la
-- fase activa.
ALTER TABLE public.game_state
  ADD COLUMN IF NOT EXISTS trivia_round_id uuid,
  ADD COLUMN IF NOT EXISTS minijuego_payload jsonb;

CREATE TABLE IF NOT EXISTS public.trivia_questions (
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  round_id uuid NOT NULL,
  question_idx integer NOT NULL,
  question_text text NOT NULL,
  options jsonb NOT NULL,
  correct_option integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, round_id, question_idx)
);

-- Normalizar los checks por nombre hace repetible la migracion y, a la vez,
-- obliga a abortar si una tabla preexistente contiene datos incompatibles.
ALTER TABLE public.trivia_questions
  DROP CONSTRAINT IF EXISTS trivia_questions_question_idx_check,
  DROP CONSTRAINT IF EXISTS trivia_questions_options_check,
  DROP CONSTRAINT IF EXISTS trivia_questions_correct_option_check,
  ADD CONSTRAINT trivia_questions_question_idx_check
    CHECK (question_idx BETWEEN 0 AND 9),
  ADD CONSTRAINT trivia_questions_options_check
    CHECK (jsonb_typeof(options) = 'array' AND jsonb_array_length(options) BETWEEN 2 AND 4),
  ADD CONSTRAINT trivia_questions_correct_option_check
    CHECK (correct_option BETWEEN 0 AND 3 AND correct_option < jsonb_array_length(options));

ALTER TABLE public.trivia_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "trivia_questions: admin gestiona" ON public.trivia_questions;
CREATE POLICY "trivia_questions: admin gestiona"
  ON public.trivia_questions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- La tabla base contiene correct_option: no debe ser accesible por anon y los
-- usuarios autenticados solo llegan a ella si la RLS confirma que son admin.
REVOKE ALL ON TABLE public.trivia_questions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.trivia_questions TO authenticated;

ALTER TABLE public.trivia_votes ADD COLUMN IF NOT EXISTS round_id uuid;
WITH legacy_sessions AS MATERIALIZED (
  SELECT DISTINCT session_id FROM public.trivia_votes WHERE round_id IS NULL
), legacy_rounds AS MATERIALIZED (
  SELECT s.session_id, COALESCE(g.trivia_round_id, gen_random_uuid()) AS round_id
  FROM legacy_sessions s LEFT JOIN public.game_state g ON g.session_id = s.session_id
)
UPDATE public.trivia_votes v SET round_id = r.round_id
FROM legacy_rounds r WHERE r.session_id = v.session_id AND v.round_id IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.trivia_votes WHERE round_id IS NULL) THEN
    RAISE EXCEPTION
      'Trivia migration aborted: legacy trivia_votes with NULL round_id remain; no votes were deleted';
  END IF;
END $$;

ALTER TABLE public.trivia_votes ALTER COLUMN round_id SET NOT NULL;

-- Quitar solamente la unique legacy cuyas columnas sean exactamente
-- (session_id, question_idx, user_id). No se compara texto de la definicion.
DO $$
DECLARE
  legacy_constraint record;
BEGIN
  FOR legacy_constraint IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.trivia_votes'::regclass
      AND c.contype = 'u'
      AND ARRAY(
        SELECT a.attname
        FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
        JOIN pg_attribute a
          ON a.attrelid = c.conrelid AND a.attnum = k.attnum
        ORDER BY k.ord
      ) = ARRAY['session_id', 'question_idx', 'user_id']::name[]
  LOOP
    EXECUTE format(
      'ALTER TABLE public.trivia_votes DROP CONSTRAINT %I',
      legacy_constraint.conname
    );
  END LOOP;
END $$;

-- Conservar exactamente una proteccion equivalente para la clave nueva. Se
-- prefiere el nombre canonico y se eliminan solamente duplicados equivalentes.
DO $$
DECLARE
  candidate record;
  kept_constraint text;
BEGIN
  FOR candidate IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.trivia_votes'::regclass
      AND c.contype = 'u'
      AND ARRAY(
        SELECT a.attname
        FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
        JOIN pg_attribute a
          ON a.attrelid = c.conrelid AND a.attnum = k.attnum
        ORDER BY k.ord
      ) = ARRAY['session_id', 'round_id', 'question_idx', 'user_id']::name[]
    ORDER BY (c.conname = 'trivia_votes_round_user_unique') DESC, c.conname
  LOOP
    IF kept_constraint IS NULL THEN
      kept_constraint := candidate.conname;
    ELSE
      EXECUTE format(
        'ALTER TABLE public.trivia_votes DROP CONSTRAINT %I',
        candidate.conname
      );
    END IF;
  END LOOP;

  IF kept_constraint IS NULL THEN
    ALTER TABLE public.trivia_votes
      ADD CONSTRAINT trivia_votes_round_user_unique
      UNIQUE (session_id, round_id, question_idx, user_id);
  END IF;
END $$;

DROP POLICY IF EXISTS "trivia_votes: todos pueden leer totales" ON public.trivia_votes;
DROP POLICY IF EXISTS "trivia_votes: usuario lee propio" ON public.trivia_votes;
CREATE POLICY "trivia_votes: usuario lee propio"
  ON public.trivia_votes FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "trivia_votes: usuario inserta propio" ON public.trivia_votes;
CREATE POLICY "trivia_votes: usuario inserta propio"
  ON public.trivia_votes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.game_state g
      WHERE g.session_id = trivia_votes.session_id
        AND g.trivia_state = 'active'
        AND g.trivia_round_id = trivia_votes.round_id
        AND g.trivia_question = trivia_votes.question_idx
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.team = trivia_votes.team
    )
  );

REVOKE SELECT ON TABLE public.trivia_votes FROM anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.trivia_votes TO authenticated;

DROP VIEW IF EXISTS public.trivia_totals;
CREATE VIEW public.trivia_totals
WITH (security_barrier = true, security_invoker = false) AS
SELECT
  v.session_id,
  v.round_id,
  v.question_idx,
  COUNT(*) FILTER (WHERE v.team = 'batata') AS batata_votes,
  COUNT(*) FILTER (WHERE v.team = 'membrillo') AS membrillo_votes,
  COUNT(*) FILTER (WHERE v.option_idx = 0) AS opt_0,
  COUNT(*) FILTER (WHERE v.option_idx = 1) AS opt_1,
  COUNT(*) FILTER (WHERE v.option_idx = 2) AS opt_2,
  COUNT(*) FILTER (WHERE v.option_idx = 3) AS opt_3,
  CASE WHEN g.trivia_state IN ('revealed', 'finished')
             AND g.trivia_round_id = v.round_id
       THEN COUNT(*) FILTER (WHERE v.team = 'batata' AND v.option_idx = q.correct_option)
       ELSE NULL END AS batata_correct,
  CASE WHEN g.trivia_state IN ('revealed', 'finished')
             AND g.trivia_round_id = v.round_id
       THEN COUNT(*) FILTER (WHERE v.team = 'membrillo' AND v.option_idx = q.correct_option)
       ELSE NULL END AS membrillo_correct,
  COUNT(*) AS total_votes
FROM public.trivia_votes v
JOIN public.trivia_questions q USING (session_id, round_id, question_idx)
JOIN public.game_state g ON g.session_id = v.session_id
GROUP BY v.session_id, v.round_id, v.question_idx,
         g.trivia_state, g.trivia_round_id;

DROP VIEW IF EXISTS public.trivia_questions_public;
CREATE VIEW public.trivia_questions_public
WITH (security_barrier = true, security_invoker = false) AS
SELECT
  q.session_id,
  q.round_id,
  q.question_idx,
  q.question_text,
  q.options,
  CASE WHEN g.trivia_state IN ('revealed', 'finished')
             AND g.trivia_round_id = q.round_id
             AND g.trivia_question = q.question_idx
       THEN q.correct_option ELSE NULL END AS correct_option
FROM public.trivia_questions q
JOIN public.game_state g USING (session_id);

REVOKE ALL ON TABLE public.trivia_questions_public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.trivia_totals FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.trivia_questions_public TO anon, authenticated;
GRANT SELECT ON TABLE public.trivia_totals TO anon, authenticated;

-- El score de Trivia no se persiste en una columna: se deriva de los votos
-- correctos. trivia_winner_team continua siendo escrito por Admin en game_state.
-- Los votos legacy se conservan, aunque sin preguntas asociadas pueden no
-- aparecer en trivia_totals historicos.
