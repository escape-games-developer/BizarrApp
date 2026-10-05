-- client_design_active: preset de diseño activo del Cliente, una fila por sección.
-- Supabase es autoridad solo de QUÉ preset está activo; el contenido de cada preset vive en código.

create table public.client_design_active (
  section     text        not null,
  design_key  text        not null default 'original',
  updated_by  uuid        null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint client_design_active_pkey primary key (section),
  constraint client_design_active_section_formato check (section ~ '^[a-z][a-z0-9_]{2,63}$'),
  constraint client_design_active_design_key_valido check (design_key = any (array['original'::text, 'cantoni'::text])),
  constraint client_design_active_updated_by_fkey foreign key (updated_by) references auth.users(id) on delete set null
);

comment on table public.client_design_active is
  'Preset de diseño activo del Cliente por sección. Lectura pública; escritura solo is_admin() (UPDATE de design_key). Filas se crean por migración.';

create or replace function public.client_design_active_touch()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

create trigger client_design_active_touch
  before update on public.client_design_active
  for each row execute function public.client_design_active_touch();

alter table public.client_design_active enable row level security;

create policy "client_design_active: todos leen"
  on public.client_design_active
  for select
  to anon, authenticated
  using (true);

create policy "client_design_active: admin actualiza"
  on public.client_design_active
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on table public.client_design_active from anon, authenticated;
grant select on table public.client_design_active to anon, authenticated;
grant update (design_key) on table public.client_design_active to authenticated;

revoke all on function public.client_design_active_touch() from public, anon, authenticated;

alter publication supabase_realtime add table public.client_design_active;

insert into public.client_design_active (section, design_key)
values ('pantalla', 'original')
on conflict (section) do nothing;
