-- Desafío Demente — Biblioteca de preguntas V2: edición y borrado por admin.
-- Incremental sobre 20260929023450_trivia_preguntas_biblioteca_v1 (no recrea nada).
-- * UPDATE: sólo admin (RLS) y sólo question_text / options / correct_option (grant por columna).
--   id, created_by, created_at y updated_at quedan fuera del alcance del cliente;
--   updated_at lo mantiene el trigger existente. Todos los CHECK y el UNIQUE
--   normalizado de V1 siguen rigiendo en cada UPDATE.
-- * DELETE: grant de tabla, limitado a admin por RLS.
-- * anon: sin cambios (ningún privilegio). Sin FK hacia esta tabla: las rondas no dependen de ella.

CREATE POLICY "trivia_preguntas_biblioteca: admin edita"
  ON public.trivia_preguntas_biblioteca FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "trivia_preguntas_biblioteca: admin borra"
  ON public.trivia_preguntas_biblioteca FOR DELETE TO authenticated
  USING (public.is_admin());

GRANT UPDATE (question_text, options, correct_option) ON TABLE public.trivia_preguntas_biblioteca TO authenticated;
GRANT DELETE ON TABLE public.trivia_preguntas_biblioteca TO authenticated;

NOTIFY pgrst, 'reload schema';
