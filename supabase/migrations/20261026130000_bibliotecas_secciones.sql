-- Secciones en las bibliotecas de Arma la Palabra y Desafío Demente.
-- * `seccion` es un texto libre (Animales, Fútbol…); null = «Sin sección».
-- * Sin tabla aparte: una sección existe mientras tenga al menos una fila.
-- * Recortada y de 1 a 40 caracteres; el panel la normaliza antes de mandarla.
-- * Los duplicados siguen siendo globales: una palabra/pregunta vive en UNA sección.

alter table public.palabra_biblioteca          add column if not exists seccion text;
alter table public.trivia_preguntas_biblioteca add column if not exists seccion text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'palabra_biblioteca_seccion_valida') then
    alter table public.palabra_biblioteca add constraint palabra_biblioteca_seccion_valida
      check (seccion is null or (seccion = btrim(seccion) and char_length(seccion) between 1 and 40));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'trivia_preguntas_biblioteca_seccion_valida') then
    alter table public.trivia_preguntas_biblioteca add constraint trivia_preguntas_biblioteca_seccion_valida
      check (seccion is null or (seccion = btrim(seccion) and char_length(seccion) between 1 and 40));
  end if;
end $$;

-- trivia_preguntas_biblioteca usa grants por columna: se suma la nueva.
grant insert (seccion), update (seccion) on public.trivia_preguntas_biblioteca to authenticated;
grant insert (seccion), update (seccion) on public.palabra_biblioteca          to authenticated;

notify pgrst, 'reload schema';
