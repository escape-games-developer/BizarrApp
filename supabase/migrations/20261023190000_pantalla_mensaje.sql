-- ─── Diseñador de pantalla TV → efecto del Mensaje de Lanzar ────────────────
--
-- Fila admin_ui_config key='pantalla_mensaje':
--   { version: 1, efecto: 'fijo' | 'banda' | 'latido' | 'neon' }
-- Efecto con el que se muestra el texto de la placa «Mensaje» (Admin →
-- Lanzar) en la TV y en el banner del celular.
--
-- Escritura: la de admin_ui_config (UPDATE de `value` con is_admin()).
-- Lectura pública con pantalla_mensaje_config(): la TV entra sin sesión.

create or replace function public.admin_ui_pantalla_mensaje_valido(v jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select jsonb_typeof(v) is not distinct from 'object'
     and jsonb_typeof(v->'version') is not distinct from 'number'
     and (v->>'version') ~ '^[1-9][0-9]*$'
     and (v->>'efecto') in ('fijo', 'banda', 'latido', 'neon')
     and (v - 'version' - 'efecto') = '{}'::jsonb;
$$;

alter table public.admin_ui_config
  add constraint admin_ui_config_pantalla_mensaje_valido
  check (key <> 'pantalla_mensaje' or public.admin_ui_pantalla_mensaje_valido(value));

insert into public.admin_ui_config (key, value)
values ('pantalla_mensaje', '{"version":1,"efecto":"fijo"}'::jsonb)
on conflict (key) do nothing;

create or replace function public.pantalla_mensaje_config()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select value from public.admin_ui_config where key = 'pantalla_mensaje';
$$;

revoke all on function public.pantalla_mensaje_config() from public;
grant execute on function public.pantalla_mensaje_config() to anon, authenticated;
