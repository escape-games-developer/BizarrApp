-- ─── Ajustes → QR en pantalla: mostrar u ocultar el QR de cada juego ─────────
--
-- Fila admin_ui_config key='pantalla_qr':
--   { version: 1, ftl: bool, pt: bool, duelo: bool }
-- Son los juegos que hoy muestran un QR en la TV (la convocatoria de Follow
-- the Leader / Personal Trainer y la del Duelo). Por defecto, todos visibles.
--
-- Escritura: la de admin_ui_config (UPDATE de `value` con is_admin()).
-- Lectura pública con pantalla_qr_config(): la TV entra sin sesión.

create or replace function public.admin_ui_pantalla_qr_valido(v jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select jsonb_typeof(v) is not distinct from 'object'
     and jsonb_typeof(v->'version') is not distinct from 'number'
     and (v->>'version') ~ '^[1-9][0-9]*$'
     and jsonb_typeof(v->'ftl')   is not distinct from 'boolean'
     and jsonb_typeof(v->'pt')    is not distinct from 'boolean'
     and jsonb_typeof(v->'duelo') is not distinct from 'boolean'
     and (v - 'version' - 'ftl' - 'pt' - 'duelo') = '{}'::jsonb;
$$;

alter table public.admin_ui_config
  add constraint admin_ui_config_pantalla_qr_valido
  check (key <> 'pantalla_qr' or public.admin_ui_pantalla_qr_valido(value));

insert into public.admin_ui_config (key, value)
values ('pantalla_qr', '{"version":1,"ftl":true,"pt":true,"duelo":true}'::jsonb)
on conflict (key) do nothing;

create or replace function public.pantalla_qr_config()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select value from public.admin_ui_config where key = 'pantalla_qr';
$$;

revoke all on function public.pantalla_qr_config() from public;
grant execute on function public.pantalla_qr_config() to anon, authenticated;
