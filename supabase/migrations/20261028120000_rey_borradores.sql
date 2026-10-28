-- Rey del Orto: el premio EN PREPARACIÓN, compartido entre dispositivos.
-- Producción lo elige en su panel y el Anfitrión lo ve en la tablet antes del
-- sorteo (para cantarlo) sin que viva sólo en la pestaña de quien lo eligió.
-- Una fila por jornada. Nombre y detalle son COPIAS (como el premio que viaja
-- a `game_state.raffle_prize`): borrar el premio de la biblioteca no los toca;
-- `premio_id` sólo sirve para que el panel de Producción lo vuelva a marcar.
-- Elegir no lanza nada: el premio recién va a `game_state` con LANZAR.

create table public.rey_borradores (
  session_id     uuid primary key references public.sessions(id) on delete cascade,
  premio_id      uuid,
  premio_nombre  text,
  premio_detalle text,
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint rey_borradores_nombre_largo  check (char_length(premio_nombre) <= 120),
  constraint rey_borradores_detalle_largo check (char_length(premio_detalle) <= 200)
);

create trigger rey_borradores_updated_at
  before update on public.rey_borradores
  for each row execute function public.update_updated_at();

alter table public.rey_borradores enable row level security;

create policy "rey_borradores: admin lee" on public.rey_borradores
  for select to authenticated using (public.is_admin());
create policy "rey_borradores: admin inserta" on public.rey_borradores
  for insert to authenticated with check (public.is_admin());
create policy "rey_borradores: admin edita" on public.rey_borradores
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on table public.rey_borradores from public, anon, authenticated;
grant select on table public.rey_borradores to authenticated;
-- update(session_id): el upsert de PostgREST reescribe todas las columnas que
-- manda, la clave incluida.
grant insert (session_id, premio_id, premio_nombre, premio_detalle),
      update (session_id, premio_id, premio_nombre, premio_detalle)
  on table public.rey_borradores to authenticated;
grant all on table public.rey_borradores to service_role;

-- Producción y Anfitrión en dos dispositivos: los cambios llegan en vivo.
alter publication supabase_realtime add table public.rey_borradores;

notify pgrst, 'reload schema';
