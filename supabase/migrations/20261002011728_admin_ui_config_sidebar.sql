-- Admin → Ajustes → Vista del panel de opciones
-- Config global de UI del Admin. Fila key='sidebar' = orden (índice del array) + visibilidad.
-- Solo presentación: no habilita/deshabilita backend ni módulos.

-- 1. Validador del JSON del sidebar
create or replace function public.admin_ui_sidebar_valido(v jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select jsonb_typeof(v) is not distinct from 'object'
     and jsonb_typeof(v->'version') is not distinct from 'number'
     and (v->>'version') ~ '^[1-9][0-9]*$'
     and jsonb_typeof(v->'items') is not distinct from 'array'
     and (v - 'version' - 'items') = '{}'::jsonb
     and jsonb_array_length(v->'items') <= 100
     and not exists (
       select 1
       from jsonb_array_elements(v->'items') e
       where jsonb_typeof(e) is distinct from 'object'
          or jsonb_typeof(e->'id') is distinct from 'string'
          or (e->>'id') !~ '^[a-z][a-zA-Z0-9]{1,63}$'
          or jsonb_typeof(e->'visible') is distinct from 'boolean'
          or (e - 'id' - 'visible') <> '{}'::jsonb
     )
     and (select count(*) from jsonb_array_elements(v->'items'))
       = (select count(distinct e->>'id') from jsonb_array_elements(v->'items') e)
     and not (v->'items' @> '[{"id":"ajustes","visible":false}]'::jsonb);
$$;

comment on function public.admin_ui_sidebar_valido(jsonb) is
  'Valida value de admin_ui_config key=sidebar: {version:int>=1, items:[{id:camelCase, visible:bool}]}, ids únicos, ajustes nunca visible=false.';

-- 2. Tabla
create table public.admin_ui_config (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_ui_config_key_formato check (key ~ '^[a-z][a-z0-9_]{2,63}$'),
  constraint admin_ui_config_value_objeto check (jsonb_typeof(value) = 'object'),
  constraint admin_ui_config_sidebar_valido check (key <> 'sidebar' or public.admin_ui_sidebar_valido(value))
);

comment on table public.admin_ui_config is
  'Config global de UI del Admin (una fila por key). key=sidebar: orden/visibilidad del sidebar; índice del array = orden. Solo presentación. Admin: SELECT + UPDATE(value). Sin INSERT/DELETE desde cliente; filas creadas por migración.';

-- 3. Trigger: updated_at/updated_by forzados server-side (patrón duelo_reglas_config_touch)
create or replace function public.admin_ui_config_touch()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

create trigger admin_ui_config_touch
  before update on public.admin_ui_config
  for each row execute function public.admin_ui_config_touch();

-- 4. Seguridad
alter table public.admin_ui_config enable row level security;

revoke all on public.admin_ui_config from anon, authenticated;
grant select on public.admin_ui_config to authenticated;
grant update (value) on public.admin_ui_config to authenticated;

create policy "admin_ui_config: admin lee" on public.admin_ui_config
  for select to authenticated
  using (public.is_admin());

create policy "admin_ui_config: admin actualiza" on public.admin_ui_config
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 5. Seed
insert into public.admin_ui_config (key, value)
values ('sidebar', '{"version":1,"items":[]}'::jsonb);
