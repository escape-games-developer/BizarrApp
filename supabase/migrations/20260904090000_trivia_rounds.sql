-- Trivia reproducible por ronda. Las respuestas correctas permanecen en una
-- tabla protegida y la vista publica solo las revela en la fase correspondiente.
ALTER TABLE public.game_state
  ADD COLUMN IF NOT EXISTS trivia_round_id uuid,
  ADD COLUMN IF NOT EXISTS minijuego_payload jsonb;

CREATE TABLE IF NOT EXISTS public.trivia_questions (
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  round_id uuid NOT NULL,
  question_idx integer NOT NULL CHECK (question_idx BETWEEN 0 AND 99),
  question_text text NOT NULL,
  options jsonb NOT NULL CHECK (jsonb_typeof(options) = 'array' AND jsonb_array_length(options) BETWEEN 2 AND 4),
  correct_option integer NOT NULL CHECK (correct_option BETWEEN 0 AND 3),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, round_id, question_idx)
);

ALTER TABLE public.trivia_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trivia_questions: admin gestiona"
  ON public.trivia_questions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

ALTER TABLE public.trivia_votes ADD COLUMN IF NOT EXISTS round_id uuid;
WITH legacy_sessions AS MATERIALIZED (
  SELECT DISTINCT session_id FROM public.trivia_votes WHERE round_id IS NULL
), legacy_rounds AS MATERIALIZED (
  SELECT s.session_id, COALESCE(g.trivia_round_id, gen_random_uuid()) AS round_id
  FROM legacy_sessions s LEFT JOIN public.game_state g ON g.session_id = s.session_id
)
UPDATE public.trivia_votes v SET round_id = r.round_id
FROM legacy_rounds r WHERE r.session_id = v.session_id AND v.round_id IS NULL;
DELETE FROM public.trivia_votes WHERE round_id IS NULL;
ALTER TABLE public.trivia_votes ALTER COLUMN round_id SET NOT NULL;

DO $$
DECLARE constraint_name text;
BEGIN
  SELECT c.conname INTO constraint_name
  FROM pg_constraint c
  WHERE c.conrelid = 'public.trivia_votes'::regclass
    AND c.contype = 'u'
    AND pg_get_constraintdef(c.oid) LIKE '%session_id%question_idx%user_id%';
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.trivia_votes DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.trivia_votes
  ADD CONSTRAINT trivia_votes_round_user_unique
  UNIQUE (session_id, round_id, question_idx, user_id);

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

DROP VIEW IF EXISTS public.trivia_totals;
CREATE VIEW public.trivia_totals AS
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
  COUNT(*) FILTER (WHERE v.team = 'batata' AND v.option_idx = q.correct_option) AS batata_correct,
  COUNT(*) FILTER (WHERE v.team = 'membrillo' AND v.option_idx = q.correct_option) AS membrillo_correct,
  COUNT(*) AS total_votes
FROM public.trivia_votes v
JOIN public.trivia_questions q USING (session_id, round_id, question_idx)
GROUP BY v.session_id, v.round_id, v.question_idx;

CREATE OR REPLACE VIEW public.trivia_questions_public AS
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

GRANT SELECT ON public.trivia_questions_public TO anon, authenticated;
GRANT SELECT ON public.trivia_totals TO anon, authenticated;
