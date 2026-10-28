-- Duelo de Talentos: los duelistas LLAMADOS, compartidos entre dispositivos.
-- Producción elige quién va de P1 y de P2 y el Anfitrión los ve en la tablet
-- para llamarlos al escenario antes de que arranque la votación. Una fila por
-- jornada; los ids son de `duelo_postulaciones`. Elegir no lanza nada: la
-- ronda la crea `duelo_launch_round`, que vuelve a validar a los dos.

create table public.duelo_borradores (
  session_id       uuid primary key references public.sessions(id) on delete cascade,
  p1_postulacion_id uuid references public.duelo_postulaciones(id) on delete set null,
  p2_postulacion_id uuid references public.duelo_postulaciones(id) on delete set null,
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create trigger duelo_borradores_updated_at
  before update on public.duelo_borradores
  for each row execute function public.update_updated_at();

alter table public.duelo_borradores enable row level security;

create policy "duelo_borradores: admin lee" on public.duelo_borradores
  for select to authenticated using (public.is_admin());
create policy "duelo_borradores: admin inserta" on public.duelo_borradores
  for insert to authenticated with check (public.is_admin());
create policy "duelo_borradores: admin edita" on public.duelo_borradores
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on table public.duelo_borradores from public, anon, authenticated;
grant select on table public.duelo_borradores to authenticated;
-- update(session_id): el upsert de PostgREST reescribe todas las columnas que
-- manda, la clave incluida.
grant insert (session_id, p1_postulacion_id, p2_postulacion_id),
      update (session_id, p1_postulacion_id, p2_postulacion_id)
  on table public.duelo_borradores to authenticated;
grant all on table public.duelo_borradores to service_role;

-- Producción y Anfitrión en dos dispositivos: los cambios llegan en vivo.
alter publication supabase_realtime add table public.duelo_borradores;

notify pgrst, 'reload schema';
