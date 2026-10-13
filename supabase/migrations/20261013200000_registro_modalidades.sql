-- ─── Ajustes → Registro de clientes: modalidades activables ──────────────────
--
-- Fila admin_ui_config key='registro':
--   { version: 1, completo: bool, mailPrimero: bool }
--
--   completo    → el registro de siempre: formulario entero (mail + contraseña
--                 al final) y mail de confirmación.
--   mailPrimero → el cliente pone sólo el mail, valida con el link y recién
--                 ahí completa el formulario con el mail fijo.
--   Las dos en false = registro cerrado.
--
-- Escritura: la de admin_ui_config (UPDATE de `value` con is_admin()).
-- Lectura pública: la app del cliente la necesita antes de tener sesión, así
-- que se expone sólo esta fila con registro_config() (anon y authenticated).
--
-- Las modalidades filtran lo que ofrece la app; no bloquean signUp en Auth.

create or replace function public.admin_ui_registro_valido(v jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select jsonb_typeof(v) is not distinct from 'object'
     and jsonb_typeof(v->'version') is not distinct from 'number'
     and (v->>'version') ~ '^[1-9][0-9]*$'
     and jsonb_typeof(v->'completo') is not distinct from 'boolean'
     and jsonb_typeof(v->'mailPrimero') is not distinct from 'boolean'
     and (v - 'version' - 'completo' - 'mailPrimero') = '{}'::jsonb;
$$;

alter table public.admin_ui_config
  add constraint admin_ui_config_registro_valido
  check (key <> 'registro' or public.admin_ui_registro_valido(value));

insert into public.admin_ui_config (key, value)
values ('registro', '{"version":1,"completo":true,"mailPrimero":false}'::jsonb)
on conflict (key) do nothing;

create or replace function public.registro_config()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select value from public.admin_ui_config where key = 'registro';
$$;

revoke all on function public.registro_config() from public;
grant execute on function public.registro_config() to anon, authenticated;
