-- Arma la Palabra · Paso 1: biblioteca global persistente de palabras (vacía, carga manual por admins)
-- Aplicada en producción (zkltjvgbpzelwzsphurg) como versión 20260926000901 / palabra_biblioteca
CREATE TABLE public.palabra_biblioteca (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  word        text        NOT NULL,
  created_by  uuid        NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT palabra_biblioteca_word_key UNIQUE (word),
  CONSTRAINT palabra_biblioteca_word_valida CHECK (public.arma_palabra_valida(word))
);

COMMENT ON TABLE public.palabra_biblioteca IS
  'Arma la Palabra: biblioteca global de palabras cargadas manualmente por admins. Sin session_id. DELETE real.';

CREATE TRIGGER palabra_biblioteca_updated_at
  BEFORE UPDATE ON public.palabra_biblioteca
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.palabra_biblioteca ENABLE ROW LEVEL SECURITY;

CREATE POLICY "palabra_biblioteca: admin gestiona"
  ON public.palabra_biblioteca
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

REVOKE ALL ON TABLE public.palabra_biblioteca FROM PUBLIC;
REVOKE ALL ON TABLE public.palabra_biblioteca FROM anon;
REVOKE ALL ON TABLE public.palabra_biblioteca FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.palabra_biblioteca TO authenticated;
