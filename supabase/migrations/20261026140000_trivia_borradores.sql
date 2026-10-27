-- Desafío Demente: la ronda EN PREPARACIÓN, compartida entre dispositivos.
-- Producción elige las preguntas en su panel y el Anfitrión las ve en la
-- tablet (y puede lanzar) sin que vivan sólo en la pestaña de quien las armó.
-- Una fila por jornada. `preguntas` = [{text, opts, correct}] (copias, igual
-- que la ronda); `cupon` = el premio que se entrega a startTrivia.

create table public.trivia_borradores (
  session_id uuid primary key references public.sessions(id) on delete cascade,
  preguntas  jsonb not null default '[]'::jsonb,
  cupon      text  not null default 'BEER50',
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint trivia_borradores_preguntas_array
    check (jsonb_typeof(preguntas) = 'array' and jsonb_array_length(preguntas) <= 10),
  constraint trivia_borradores_cupon_largo check (char_length(cupon) <= 40)
);

create trigger trivia_borradores_updated_at
  before update on public.trivia_borradores
  for each row execute function public.update_updated_at();

alter table public.trivia_borradores enable row level security;

create policy "trivia_borradores: admin lee" on public.trivia_borradores
  for select to authenticated using (public.is_admin());
create policy "trivia_borradores: admin inserta" on public.trivia_borradores
  for insert to authenticated with check (public.is_admin());
create policy "trivia_borradores: admin edita" on public.trivia_borradores
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on table public.trivia_borradores from public, anon, authenticated;
grant select on table public.trivia_borradores to authenticated;
-- update(session_id): el upsert de PostgREST reescribe todas las columnas que
-- manda, la clave incluida.
grant insert (session_id, preguntas, cupon), update (session_id, preguntas, cupon)
  on table public.trivia_borradores to authenticated;
grant all on table public.trivia_borradores to service_role;

-- Producción y Anfitrión en dos dispositivos: los cambios llegan en vivo.
alter publication supabase_realtime add table public.trivia_borradores;

notify pgrst, 'reload schema';
