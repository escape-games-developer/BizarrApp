-- Desafío Demente V1 — Biblioteca persistente de preguntas (catálogo administrativo).
-- * Independiente de trivia_questions: la ronda copia la pregunta y no depende de esta fila.
-- * options: array de 2–4 strings no vacíos (después de trim); correct_option 0-based,
--   mismo criterio que trivia_questions (0 <= correct_option < jsonb_array_length(options)).
-- * Duplicados: UNIQUE sobre el texto normalizado (minúsculas + trim + espacios internos
--   colapsados). No se tocan tildes, signos ni contenido.
-- * Admin: SELECT + INSERT. Sin UPDATE ni DELETE en V1. anon sin acceso.
-- * created_by = auth.uid() (default, sin grant de columna y exigido por la policy).

CREATE FUNCTION public.trivia_biblioteca_opciones_validas(p_options jsonb)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  SELECT CASE
    WHEN p_options IS NULL OR jsonb_typeof(p_options) <> 'array' THEN false
    WHEN jsonb_array_length(p_options) NOT BETWEEN 2 AND 4 THEN false
    ELSE NOT EXISTS (
      SELECT 1
        FROM jsonb_array_elements(p_options) AS e(v)
       WHERE jsonb_typeof(e.v) <> 'string'
          OR (e.v #>> '{}') ~ '^\s*$')
  END;
$function$;

REVOKE ALL ON FUNCTION public.trivia_biblioteca_opciones_validas(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trivia_biblioteca_opciones_validas(jsonb) TO authenticated, service_role;

CREATE TABLE public.trivia_preguntas_biblioteca (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  question_text  text        NOT NULL,
  options        jsonb       NOT NULL,
  correct_option integer     NOT NULL,
  created_by     uuid        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trivia_preguntas_biblioteca_texto_no_vacio
    CHECK (question_text !~ '^\s*$'),
  CONSTRAINT trivia_preguntas_biblioteca_opciones_validas
    CHECK (public.trivia_biblioteca_opciones_validas(options)),
  CONSTRAINT trivia_preguntas_biblioteca_correcta_valida
    CHECK (correct_option >= 0
           AND CASE WHEN jsonb_typeof(options) = 'array'
                    THEN correct_option < jsonb_array_length(options)
                    ELSE false END)
);

-- Protección definitiva contra duplicados triviales de formato.
CREATE UNIQUE INDEX trivia_preguntas_biblioteca_texto_norm_key
  ON public.trivia_preguntas_biblioteca
  (lower(btrim(regexp_replace(question_text, '\s+', ' ', 'g'))));

CREATE INDEX trivia_preguntas_biblioteca_created_at_idx
  ON public.trivia_preguntas_biblioteca (created_at);

-- updated_at para compatibilidad futura (ningún cliente tiene UPDATE en V1).
CREATE TRIGGER trivia_preguntas_biblioteca_updated_at
  BEFORE UPDATE ON public.trivia_preguntas_biblioteca
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.trivia_preguntas_biblioteca ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trivia_preguntas_biblioteca: admin lee"
  ON public.trivia_preguntas_biblioteca FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY "trivia_preguntas_biblioteca: admin inserta"
  ON public.trivia_preguntas_biblioteca FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() AND created_by = auth.uid());

REVOKE ALL ON TABLE public.trivia_preguntas_biblioteca FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.trivia_preguntas_biblioteca TO authenticated;
GRANT INSERT (question_text, options, correct_option) ON TABLE public.trivia_preguntas_biblioteca TO authenticated;
GRANT ALL ON TABLE public.trivia_preguntas_biblioteca TO service_role;

NOTIFY pgrst, 'reload schema';
